import {jointValue} from './jointCoordinates.js';
import { Quaternion, Vector3 } from 'three';
import {shiftInertiaToCenterOfMass} from './massProperties.js';
import {validateSnapshot,getSnapshotIssues} from './index.js';
import {transformSnapshot} from './transform.js';
const vector = (a = [0, 0, 0]) => ({ x: a[0], y: a[1], z: a[2] });
const rotation = (a = [0, 0, 0, 1]) => ({ x: a[0], y: a[1], z: a[2], w: a[3] });
const q = a => new Quaternion().fromArray(a || [0, 0, 0, 1]);
const axis = name => new Vector3(...(name === 'X' ? [1, 0, 0] : name === 'Z' ? [0, 0, 1] : [0, 1, 0]));
const contains = (parent, child) => child === parent || child.startsWith(parent + '/');
const emptyVisualBinding = {sync(){},reset(){},bodyForObject(){return null;}};

/** Descriptors the Rapier adapter cannot simulate, known before loading its runtime. */
export function getSimulationLimitations(snapshot) {
    const issues=[...(snapshot.unsupported||[]),...getSnapshotIssues(snapshot)];
    for(const shape of snapshot.shapes||[])if(shape.collisionEnabled!==false && shape.type==='mesh' && shape.approximation && !['none','convexHull'].includes(shape.approximation))
        issues.push({path:shape.path,type:'mesh',reason:`Mesh approximation ${shape.approximation} is not supported.`});
    for(const joint of snapshot.joints||[])if(joint.mimic)issues.push({path:joint.path,type:joint.type,reason:"Mimic joint coupling is not supported by this contact adapter."});
    return issues;
}

/**
 * Create a simulation in stage coordinates. Supply an initialized Rapier module;
 * importing the USD renderer alone does not download another WASM runtime.
 */
export async function createSimulation({ rapier: R, snapshot, scenePath, mode = 'simulation', allowPartial = false, bindVisuals, worldContext }) {
    snapshot={bodies:[],shapes:[],joints:[],materials:[],groups:[],scenes:[],...snapshot};
    validateSnapshot(snapshot);
    if (!R?.World) throw new TypeError('Supply an initialized Rapier module.');
    const initialIssues=getSimulationLimitations(snapshot).filter(item=>mode!=='interaction'||!/Shape$|^mesh$|^Articulation$/.test(item.type||''));
    if(!allowPartial&&initialIssues.length)throw new Error(`Simulation unavailable: ${initialIssues[0].reason}`);
    const scenes = snapshot.scenes || [];
    if (scenes.length > 1 && !scenePath) throw new Error('Select a USD physics scene before simulating.');
    const scene = scenePath ? scenes.find(s => s.path === scenePath) : scenes[0];
    if (scenePath && !scene) throw new Error(`USD physics scene not found: ${scenePath}`);
    const mpu = snapshot.metersPerUnit > 0 ? snapshot.metersPerUnit : 0.01;
    const kgpu = snapshot.kilogramsPerUnit > 0 ? snapshot.kilogramsPerUnit : 1;
    const direction = scene?.gravityDirection || (snapshot.upAxis === 'Z' ? [0, 0, -1] : [0, -1, 0]);
    const magnitude = Number.isFinite(scene?.gravityMagnitude) && scene.gravityMagnitude >= 0 ? scene.gravityMagnitude : 9.81 / mpu;
    const gravity = new Vector3().fromArray(direction).normalize().multiplyScalar(magnitude);
    const ownsWorld = !worldContext;
    const world = worldContext?.world || new R.World(mode === 'interaction' ? {x:0,y:0,z:0} : gravity);
    // Rapier dispatches contact hooks only through stepWithEvents.
    const events = worldContext?.events || new R.EventQueue(true);
    if (ownsWorld) { world.timestep = 1 / 120; world.lengthUnit = 1 / mpu; world.numSolverIterations = 12; }
    const bodies = new Map(), colliders = new Map(), joints = new Map(), controls = new Map();
    // Joint inspection does not solve contacts or require PhysX SDF colliders
    // or a reduced-coordinate articulation. Its dependent joints still share
    // one constraint solver, including closed loops and fixed attachments.
    const unsupported = initialIssues;
    const warn = (item, reason) => {if(!unsupported.some(issue=>issue.path===item.path&&issue.reason===reason))unsupported.push({ path: item.path, type: item.type, reason });};
    const inScene = item => item.simulationOwners?.length ? !!scene && item.simulationOwners.includes(scene.path)
        : !scene || scene.path === scenes[0]?.path;
    let playing = false, disposed = false, accumulator = 0, drag = null;
    const ownedBodies = new Set(), ownedColliders = new Set(), ownedJoints = new Set();
    let visuals, unregister;
    const release = () => {
        unregister?.();
        if (ownsWorld) { try{events.free();}finally{world.free();} }
        else {
            for (const joint of ownedJoints) if (world.impulseJoints.contains(joint.handle)) world.removeImpulseJoint(joint, true);
            for (const body of ownedBodies) if (world.bodies.contains(body.handle)) world.removeRigidBody(body);
            for (const collider of ownedColliders) if (world.colliders.contains(collider.handle)) world.removeCollider(collider, true);
        }
    };
    const makeBody = desc => { const body = world.createRigidBody(desc); ownedBodies.add(body); return body; };
    const makeJoint = (desc, a, b) => { const joint = world.createImpulseJoint(desc, a, b, true); ownedJoints.add(joint); return joint; };

    try {
        for (const data of snapshot.bodies || []) {
            if (!inScene(data)) continue;
            const desc = data.rigidBodyEnabled === false ? R.RigidBodyDesc.fixed()
                : data.kinematicBody ? R.RigidBodyDesc.kinematicPositionBased() : R.RigidBodyDesc.dynamic();
            desc.setTranslation(...data.position).setRotation(rotation(data.rotation));
            desc.setLinvel(...(data.linearVelocity || [0, 0, 0]));
            desc.setAngvel(new Vector3().fromArray(data.angularVelocity || [0, 0, 0]).multiplyScalar(Math.PI / 180));
            desc.setSleeping(!!data.startsAsleep);
            if (!data.kinematicBody && data.rigidBodyEnabled !== false) desc.setCcdEnabled(true);
            bodies.set(data.path, { data, body: makeBody(desc), colliders: [] });
        }
        const materialMap = new Map((snapshot.materials || []).map(m => [m.path, m]));
        for (const data of mode === 'interaction' ? [] : snapshot.shapes || []) {
            if (data.collisionEnabled === false || !inScene(data)) continue;
            const owner = bodies.get(data.body);
            if (data.body && !owner) continue;
            let desc, extraRotation = new Quaternion();
            switch (data.type) {
                case 'cube': desc = R.ColliderDesc.cuboid(...data.halfExtents); break;
                case 'sphere': desc = R.ColliderDesc.ball(data.radius); break;
                case 'capsule': desc = R.ColliderDesc.capsule(data.halfHeight, data.radius); break;
                case 'cylinder': desc = R.ColliderDesc.cylinder(data.halfHeight, data.radius); break;
                case 'cone': desc = R.ColliderDesc.cone(data.halfHeight, data.radius); break;
                case 'plane': desc = R.ColliderDesc.halfspace(axis(data.axis)); break;
                case 'mesh': {
                    const points = Float32Array.from(data.points || [], (v, i) => v * (data.meshScale?.[i % 3] ?? 1));
                    if (!points.length) { warn(data, 'Mesh collision points are unavailable.'); continue; }
                    if (data.approximation === 'convexHull') desc = R.ColliderDesc.convexHull(points);
                    else if (!data.approximation || data.approximation === 'none') {
                        if (owner?.body.isDynamic()) { warn(data, 'Dynamic triangle meshes require an authored convex approximation.'); continue; }
                        desc = R.ColliderDesc.trimesh(points, Uint32Array.from(data.indices || []));
                    } else { warn(data, `Mesh approximation ${data.approximation} is not supported.`); continue; }
                    break;
                }
                default: warn(data, 'Collider type is not supported.'); continue;
            }
            if (!desc) { warn(data, 'Collider could not be constructed.'); continue; }
            if (['capsule', 'cylinder', 'cone'].includes(data.type)) extraRotation.setFromUnitVectors(new Vector3(0, 1, 0), axis(data.axis));
            const r = q(data.rotation).multiply(extraRotation);
            desc.setTranslation(...(data.position || [0, 0, 0])).setRotation(r);
            const material = data.materials?.map(path => materialMap.get(path)).find(Boolean);
            desc.setFriction(material?.dynamicFriction ?? 0.5).setRestitution(material?.restitution ?? 0);
            const density = data.density > 0 ? data.density : owner?.data.density > 0 ? owner.data.density : material?.density;
            desc.setDensity(density > 0 ? density * kgpu : 1000 * mpu ** 3);
            if (data.mass > 0) desc.setMass(data.mass * kgpu);
            if (data.path !== owner?.data.path && (data.centerOfMass || data.diagonalInertia || data.principalAxes)) {
                warn(data, 'Collider-local center of mass and inertia overrides are not supported.');
            }
            desc.setActiveHooks(R.ActiveHooks.FILTER_CONTACT_PAIRS);
            const collider = world.createCollider(desc, owner?.body); ownedColliders.add(collider);
            colliders.set(collider.handle, { data, collider, owner });
            owner?.colliders.push(collider);
        }
        for (const { data, body, colliders: owned } of bodies.values()) {
            body.recomputeMassPropertiesFromColliders();
            if (mode!=='interaction' && !(data.mass > 0) && !data.centerOfMass && !data.diagonalInertia && !data.principalAxes) continue;
            const oldMass = body.mass(), mass = data.mass > 0 ? data.mass * kgpu : oldMass || (mode==='interaction'?1:0);
            let inertia = data.diagonalInertia ? new Vector3().fromArray(data.diagonalInertia).multiplyScalar(kgpu)
                : new Vector3().copy(body.principalInertia()).multiplyScalar(oldMass > 0 ? mass / oldMass : 1);
            const com = data.centerOfMass ? new Vector3().fromArray(data.centerOfMass).multiply(new Vector3().fromArray(data.scale || [1, 1, 1])) : body.localCom();
            let frame = body.principalInertiaLocalFrame();
            if(mode==='interaction'&&!data.diagonalInertia&&inertia.lengthSq()===0)inertia.setScalar(mass);
            if (data.centerOfMass && !data.diagonalInertia) {
                const shifted = shiftInertiaToCenterOfMass(inertia, frame, mass, body.localCom(), com);
                inertia = shifted.diagonalInertia; frame = shifted.principalAxes;
            }
            if (data.principalAxes) frame = rotation(data.principalAxes);
            for (const collider of owned) collider.setDensity(0);
            body.setAdditionalMassProperties(mass, com, inertia, frame, false);
            body.recomputeMassPropertiesFromColliders();
        }
        const fixedWorld = makeBody(R.RigidBodyDesc.fixed());
        for (const data of snapshot.joints || []) {
            if (data.jointEnabled === false) continue;
            const b0 = data.body0 ? bodies.get(data.body0)?.body : fixedWorld;
            const b1 = data.body1 ? bodies.get(data.body1)?.body : fixedWorld;
            if (!b0 || !b1) { warn(data, 'A joint body is outside the selected simulation scene.'); continue; }
            const a0 = vector(data.position0), a1 = vector(data.position1), r0 = rotation(data.rotation0), r1 = rotation(data.rotation1);
            let desc;
            if (data.type === 'fixed') desc = R.JointData.fixed(a0, r0, a1, r1);
            else if (data.type === 'spherical') {
                if (data.limit?.enabled) { warn(data, 'Spherical joint cone limits are not supported.'); continue; }
                desc = R.JointData.spherical(a0, a1);
            } else if (data.type === 'revolute' || data.type === 'prismatic') {
                // Rapier's public unit-joint API accepts a shared local axis/frame.
                // Never discard independently authored frames or their limit origin.
                if (!R.ImpulseJoint?.prototype.setLocalFrame1 && (q(data.rotation0).angleTo(q(data.rotation1)) > 1e-5 ||
                    (data.type === 'prismatic' && q(data.rotation0).angleTo(new Quaternion()) > 1e-5))) {
                    warn(data, 'Independent joint frame rotations are not supported by this Rapier adapter.'); continue;
                }
                const jointAxis = axis(data.axis).applyQuaternion(q(data.rotation0));
                desc = R.JointData[data.type](a0, a1, jointAxis);
            } else if (data.type === 'distance' && !data.minEnabled && data.maxEnabled) {
                desc = R.JointData.rope(data.limit?.upper ?? data.maxDistance, a0, a1);
            } else { warn(data, 'Joint type or limits are not supported.'); continue; }
            if (Number.isFinite(data.breakForce) || Number.isFinite(data.breakTorque)) {
                warn(data, 'Joint breaking thresholds are not supported.');
            }
            const joint = makeJoint(desc, b0, b1);
            if ((data.type === 'revolute' || data.type === 'prismatic') && joint.setLocalFrame1) {
                // Rapier unit joints use X in their local frame. Rotate that
                // basis into USD's authored axis, then apply each local frame.
                const basis = new Quaternion().setFromUnitVectors(new Vector3(1,0,0),axis(data.axis));
                joint.setLocalFrame1(a0,q(data.rotation0).multiply(basis));
                joint.setLocalFrame2(a1,q(data.rotation1).multiply(basis));
            }
            joint.setContactsEnabled(!!data.collisionEnabled);
            const angular = data.type === 'revolute', unit = angular ? Math.PI / 180 : 1;
            if (data.limit?.enabled && joint.setLimits) joint.setLimits((data.limit.lower ?? -Infinity) * unit, (data.limit.upper ?? Infinity) * unit);
            if (data.drive?.enabled && joint.configureMotor) {
                const d = data.drive;
                if (Number.isFinite(d.forceLimit)) {
                    if(joint.setMotorMaxForce)joint.setMotorMaxForce(d.forceLimit*kgpu);
                    else warn(data, 'Drive force limits are not supported by this Rapier version.');
                }
                joint.configureMotorModel(d.acceleration ? R.MotorModel.AccelerationBased : R.MotorModel.ForceBased);
                const gainScale = (d.acceleration ? 1 : kgpu) / unit;
                joint.configureMotor(d.targetPosition * unit, d.targetVelocity * unit, d.stiffness * gainScale, d.damping * gainScale);
            }
            joints.set(data.path, joint);
            controls.set(data.path,{data,drive:{...data.drive}});
        }

        const groupMap = new Map((snapshot.groups || []).map(g => [g.path, g]));
        const groupAliases = new Map();
        for (const group of snapshot.groups || []) for (const path of [group.path, ...(group.mergedGroups || [])]) groupAliases.set(path, group.path);
        const canonicalGroup = path => groupAliases.get(path) || path;
        const excludes = (a, b) => (a.data.filteredCollisions || []).some(p => contains(p, b.data.path) || p === b.data.body)
            || (a.owner?.data.filteredCollisions || []).some(p => contains(p, b.data.path) || p === b.data.body);
        const groupExcludes = (a, b) => (a.data.collisionGroups || []).some(path => {
            const g = groupMap.get(canonicalGroup(path));
            if (!g) return false;
            const filtered = (b.data.collisionGroups || []).some(other => (g.filteredGroups || []).some(target => canonicalGroup(target) === canonicalGroup(other)));
            return g.invertFilteredGroups ? !filtered : filtered;
        });
        const hooks = {
            filterContactPair(a, b) {
                const c0 = colliders.get(a), c1 = colliders.get(b);
                return c0 && c1 && (excludes(c0, c1) || excludes(c1, c0) || groupExcludes(c0, c1) || groupExcludes(c1, c0))
                    ? null : R.SolverFlags.COMPUTE_IMPULSE;
            },
            filterIntersectionPair() { return true; },
        };
        if(!allowPartial && unsupported.length)throw new Error(`Simulation unavailable: ${unsupported[0].reason}${unsupported.length>1?` (${unsupported.length} unsupported features)`:''}`);
        // Pending visual setup must not expose an unregistered physical asset.
        if(worldContext){for(const body of ownedBodies)body.setEnabled(false);for(const collider of ownedColliders)collider.setEnabled(false);}
        visuals = await bindVisuals?.(bodies, warn) || emptyVisualBinding;
        if(!allowPartial&&unsupported.length)throw new Error(`Simulation unavailable: ${unsupported[0].reason}`);
        const sync=visuals.sync;
        unregister = worldContext?.register({hooks, sync});
        if(worldContext){for(const body of ownedBodies)body.setEnabled(true);for(const collider of ownedColliders)collider.setEnabled(true);for(const {body,data}of bodies.values())if(data.startsAsleep)body.sleep();}
        function endDrag() {
            if (!drag) return;
            world.removeImpulseJoint(drag.joint, true); world.removeRigidBody(drag.anchor);
            for(const {body,type} of drag.pinned){body.setBodyType(type,true);body.setLinvel(vector(),true);body.setAngvel(vector(),true);}
            drag = null;
        }
        function reset() {
            if (disposed) return;
            endDrag(); playing = false; accumulator = 0;
            for (const { body, data } of bodies.values()) {
                body.setTranslation(vector(data.position), true); body.setRotation(rotation(data.rotation), true);
                body.setLinvel(vector(data.linearVelocity), true);
                body.setAngvel(new Vector3().fromArray(data.angularVelocity || [0, 0, 0]).multiplyScalar(Math.PI / 180), true);
                body.resetForces(true); body.resetTorques(true);
                if (data.startsAsleep) body.sleep();
            }
            for(const [path,record] of controls)if(record.data.drive?.enabled&&joints.get(path).configureMotor){record.drive={...record.data.drive};const unit=record.data.type==='revolute'?Math.PI/180:1,gain=(record.drive.acceleration?1:kgpu)/unit;joints.get(path).configureMotor(record.drive.targetPosition*unit,record.drive.targetVelocity*unit,record.drive.stiffness*gain,record.drive.damping*gain);}
            visuals.reset();
        }
        return {
            world, bodies, joints, unsupported,
            play() { if (!disposed) { playing = true; } },
            pause() { playing = false; endDrag(); },
            isPlaying: () => playing,
            update(dt) {
                if (!playing || disposed || !ownsWorld) return;
                accumulator += Math.min(0.1, Math.max(0, dt));
                while (accumulator >= world.timestep) { world.step(events, hooks); accumulator -= world.timestep; }
                sync();
            },
            step(dt = world.timestep) {
                if (disposed) throw new Error('Simulation is disposed.');
                if (!ownsWorld) throw new Error('Step the owning simulation world.');
                if (!Number.isFinite(dt) || dt <= 0) throw new RangeError('Step duration must be positive and finite.');
                world.timestep = dt; world.step(events, hooks); sync();
            },
            reset,
            getJointValue(path) {const record=controls.get(path);return record?jointValue(record.data,bodies):null;},
            setJointTarget(path,{position,velocity}={}) {
                const record=controls.get(path),joint=joints.get(path);
                if(disposed||!record?.drive.enabled||!joint?.configureMotor)return false;
                if(position!==undefined&&!Number.isFinite(position)||velocity!==undefined&&!Number.isFinite(velocity))throw new RangeError('Motor targets must be finite.');
                const drive={...record.drive,targetPosition:position??record.drive.targetPosition,targetVelocity:velocity??record.drive.targetVelocity};
                const unit=record.data.type==='revolute'?Math.PI/180:1,gain=(drive.acceleration?1:kgpu)/unit;
                joint.configureMotor(drive.targetPosition*unit,drive.targetVelocity*unit,drive.stiffness*gain,drive.damping*gain);
                record.drive=drive;return true;
            },
            bodyForObject: visuals.bodyForObject,
            beginDrag(path, position) {
                endDrag();
                const body = bodies.get(path)?.body;
                if (!body?.isDynamic() || !playing) return false;
                const local = new Vector3().copy(position).sub(body.translation()).applyQuaternion(new Quaternion().copy(body.rotation()).invert());
                const anchor = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z));
                // A rigid mouse constraint fights the mechanism's own limits
                // when the pointer moves beyond its range. A damped spring
                // lets the grab yield while the authored joints stay rigid.
                const mass=Math.max(body.mass(),1e-6);
                const joint = world.createImpulseJoint(R.JointData.spring(0,400*mass,40*mass,local,vector()), body, anchor, true);
                const pinned=[];
                if(mode==='interaction'){
                    // Hold the mechanism's base while inspecting a movable
                    // part. All dependent links remain in the same solver.
                    const connected=new Set([path]);let changed=true;
                    while(changed){changed=false;for(const item of snapshot.joints||[]){
                      if(!joints.has(item.path)||!connected.has(item.body0)&&!connected.has(item.body1))continue;
                      for(const target of [item.body0,item.body1])if(target&&!connected.has(target)){connected.add(target);changed=true;}
                    }}
                    const links=(snapshot.joints||[]).filter(item=>joints.has(item.path)&&connected.has(item.body0));
                    const roots=links.filter(item=>!links.some(other=>other.body1===item.body0)).map(item=>item.body0);
                    const base=[...new Set(roots)].map(key=>bodies.get(key)).find(item=>item&&item.body!==body);
                    if(base?.body.isDynamic()){
                      pinned.push({body:base.body,type:base.body.bodyType()});base.body.setBodyType(R.RigidBodyType.Fixed,true);
                    }
                }
                drag = { anchor, joint, pinned }; return true;
            },
            moveDrag(position) { drag?.anchor.setNextKinematicTranslation(position); },
            endDrag,
            dispose() {
                if (disposed) return;
                try{reset();}finally{disposed=true;playing=false;release();}
            },
        };
    } catch (error) { try{visuals?.reset();}finally{release();} throw error; }
}

/** One host-owned contact world for independently loaded asset instances. */
export function createSimulationWorld({rapier: R, gravity, timestep = 1 / 120, metersPerUnit = 1, kilogramsPerUnit = 1} = {}) {
    gravity ||= [0,-9.81/metersPerUnit,0];
    if (!R?.World || !Number.isFinite(metersPerUnit) || !Number.isFinite(kilogramsPerUnit) || !(metersPerUnit > 0) || !(kilogramsPerUnit > 0) || !Number.isFinite(timestep) || timestep <= 0 || gravity.length !== 3 || !gravity.every(Number.isFinite)) throw new TypeError('Invalid Rapier world options.');
    const world = new R.World(vector(gravity)), events = new R.EventQueue(true), registrations = new Set(), assets = new Map(), pending = new Set();
    world.timestep = timestep; world.lengthUnit = 1 / metersPerUnit; world.numSolverIterations = 12;
    let disposed = false, nextId = 1;
    let freed=false;
    const finalize=()=>{if(disposed&&!pending.size&&!freed){freed=true;try{events.free();}finally{world.free();}}};
    const active = () => {if (disposed) throw new Error('Simulation world is disposed.');};
    const hooks = {
        filterContactPair(a, b) {
            for (const entry of registrations) if (entry.hooks.filterContactPair(a, b) === null) return null;
            return R.SolverFlags.COMPUTE_IMPULSE;
        },
        filterIntersectionPair() {return true;},
    };
    const context = {world, events, register(entry) {registrations.add(entry); return () => registrations.delete(entry);}};
    const host = {
        world, assets, metersPerUnit, kilogramsPerUnit,
        async addAsset({snapshot, id = 'asset-' + nextId++, position, rotation, bindVisuals, ...options}) {
            active();
            if(options.mode&&options.mode!=='simulation')throw new Error('Shared worlds run dynamics; use createMechanism for posing.');
            if (assets.has(id) || pending.has(id)) throw new Error('Duplicate simulation asset: ' + id);
            pending.add(id);
            let runtime;
            try {
                validateSnapshot(snapshot);
                const issues=getSimulationLimitations(snapshot);
                if(!options.allowPartial&&issues.length)throw new Error(`Simulation unavailable: ${issues[0].reason}`);
                const resolved = transformSnapshot(snapshot, {metersPerUnit, kilogramsPerUnit, position, rotation});
                runtime = await createSimulation({...options, rapier: R, snapshot: resolved, bindVisuals, worldContext: context});
                if (disposed) {runtime.dispose(); throw new Error('Simulation world is disposed.');}
                const release = runtime.dispose.bind(runtime);
                let detached=false;
                runtime.dispose = () => {if(detached)return;detached=true;try{release();}finally{if(assets.get(id)===runtime)assets.delete(id);}};
                runtime.id = id; runtime.snapshot = resolved;
                assets.set(id, runtime);
                return runtime;
            } finally {pending.delete(id);finalize();}
        },
        removeAsset(id) {active(); const runtime = assets.get(id); runtime?.dispose(); return !!runtime;},
        step(dt = timestep) {
            active();
            if (!Number.isFinite(dt) || dt <= 0) throw new RangeError('Step duration must be positive and finite.');
            world.timestep = dt; world.step(events, hooks);
            for (const entry of registrations) entry.sync();
        },
        dispose() {
            if (disposed) return;
            disposed=true;const errors=[];
            for(const runtime of [...assets.values()])try{runtime.dispose();}catch(error){errors.push(error);}
            try{finalize();}catch(error){errors.push(error);}
            if(errors.length)throw new AggregateError(errors,'Simulation world disposal failed.');
        },
    };
    return host;
}

export {shiftInertiaToCenterOfMass} from './massProperties.js';
