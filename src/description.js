// @ts-check
/** @typedef {import('./index.js').PhysicsSnapshot} PhysicsSnapshot */
/** @typedef {import('./index.js').PhysicsBody} PhysicsBody */
/** @typedef {import('./index.js').PhysicsShape} PhysicsShape */
/** @typedef {import('./index.js').PhysicsJoint} PhysicsJoint */
/** @typedef {import('./index.js').PhysicsIssue} PhysicsIssue */
/** @typedef {{x:number,y:number,z:number}} Vector */
/** @typedef {Vector & {w:number}} Rotation */
/** @typedef {{mass?:number,centerOfMass?:Vector,inertia?:Vector,inertiaRotation?:Rotation}} MassDescription */
/**
 * Collider shapes. Capsules, cylinders and cones point along local +Y.
 * @typedef {{type:'box',halfExtents:Vector}|{type:'sphere',radius:number}
 * |{type:'capsule'|'cylinder'|'cone',radius:number,halfHeight:number}|{type:'plane',normal?:Vector}
 * |{type:'convexHull',points:Float32Array}|{type:'triangleMesh',points:Float32Array,indices:Uint32Array}
 * |{type:'convexDecomposition',points:Float32Array,indices:Uint32Array,maxHulls?:number,resolution?:number,concavity?:number}} ShapeDescription
 */
/** @typedef {{id:string,type:'dynamic'|'kinematic'|'fixed',position:Vector,rotation:Rotation,linearVelocity:Vector,angularVelocity:Vector,
 * sleeping:boolean,continuousCollision:boolean,mass?:MassDescription}} BodyDescription */
/** @typedef {{id:string,body?:string,shape:ShapeDescription,position:Vector,rotation:Rotation,friction:number,restitution:number,density:number,mass?:MassDescription}} ColliderDescription */
/** @typedef {{model:'force'|'acceleration',stiffness:number,damping:number,maxForce?:number,targetPosition:number,targetVelocity:number}} DriveDescription */
/** @typedef {{id:string,type:'fixed'|'revolute'|'prismatic'|'spherical'|'distance'|'spring',body0?:string,body1?:string,
 * anchor0:Vector,rotation0:Rotation,anchor1:Vector,rotation1:Rotation,axis:Vector,limits?:{lower:number,upper:number},
 * drive?:DriveDescription,maxDistance?:number,spring?:{stiffness:number,damping:number,restLength?:number},
 * coneLimit?:number,breakForce?:number,breakTorque?:number,collisionEnabled:boolean,articulation?:string,
 * coupling?:{joint:string,multiplier:number,offset:number}}} JointDescription */
/** @typedef {{id:string,bodies:string[],solverIterations:number}} ArticulationDescription */
/** What the target physics backend supports. jointCoupling says whether joints can follow other joints.
 * @typedef {{backend:string,shapes:ReadonlySet<string>,joints:ReadonlySet<string>,features:ReadonlySet<string>,
 * jointCoupling?:'native'|'emulated'|'none'}} Capabilities */
/** @typedef {{path:string,source:string,target:string,reason:string}} Adaptation */
/** @typedef {{data:PhysicsShape,owner?:PhysicsBody}} ColliderData */
/** @typedef {{
 * scene:PhysicsSnapshot['scenes'][number]|undefined,metersPerUnit:number,kilogramsPerUnit:number,
 * bodies:BodyDescription[],colliders:ColliderDescription[],joints:JointDescription[],articulations:ArticulationDescription[],
 * bodyData:Map<string,PhysicsBody>,colliderData:Map<string,ColliderData>,jointData:Map<string,PhysicsJoint>,
 * issues:PhysicsIssue[],adaptations:Adaptation[],shouldCollide(a:string,b:string):boolean
 * }} SimulationDescription */

import {Quaternion, Vector3} from 'three';
import {shiftInertiaToCenterOfMass} from './massProperties.js';
import {isNumberBuffer} from './validation.js';

/** @param {import('./index.js').PhysicsVector} [a] @returns {Vector} */
const vector = (a = [0, 0, 0]) => ({x: a[0], y: a[1], z: a[2]});
/** @param {import('./index.js').PhysicsRotation | undefined} a */
const q = a => new Quaternion().fromArray(a || [0, 0, 0, 1]);
/** @param {Quaternion} value @returns {Rotation} */
const rotation = value => ({x: value.x, y: value.y, z: value.z, w: value.w});
/** @param {Vector3} value @returns {Vector} */
const plain = value => ({x: value.x, y: value.y, z: value.z});
/** @param {string | undefined} name */
const axis = name => new Vector3(...(name === 'Y' ? [0, 1, 0] : name === 'Z' ? [0, 0, 1] : [1, 0, 0]));
/** @param {string} parent @param {string} child */
const contains = (parent, child) => child === parent || child.startsWith(parent + '/');
/** @param {number | null | undefined} value */
const positive = value => (value ?? 0) > 0;

/** What SimReady's own Rapier builder supports, depending on the Rapier version passed in. */
/** @param {{ColliderDesc?:{halfspace?:unknown,convexDecomposition?:unknown},CompoundFlags?:unknown}} [R] @returns {Capabilities} */
export function rapierCapabilities(R) {
    const shapes = new Set(['box', 'sphere', 'capsule', 'cylinder', 'cone', 'convexHull', 'triangleMesh']);
    if (!R || R.ColliderDesc?.halfspace) shapes.add('plane');
    if (!R || R.ColliderDesc?.convexDecomposition && R.CompoundFlags) shapes.add('convexDecomposition');
    return {backend: 'rapier', shapes, joints: new Set(['fixed', 'revolute', 'prismatic', 'spherical', 'distance', 'spring']),
        features: new Set(['jointLimits', 'jointDrives', 'driveForceLimits', 'accelerationDrives', 'collisionFilter', 'continuousCollision']),
        jointCoupling: 'emulated'};
}

/**
 * Convert a snapshot into the body, collider and joint descriptions that buildRapierAsset and
 * Needle Engine's physics.createAsset build.
 * Lengths and masses stay in the snapshot's units; angles become radians.
 * Anything the backend can't handle is left out and listed in `issues`.
 */
/** @param {PhysicsSnapshot} snapshot
 * @param {{scenePath?:string,mode?:'simulation'|'interaction',capabilities:Capabilities}} options
 * @returns {SimulationDescription}
 */
export function describeSimulation(snapshot, {scenePath, mode = 'simulation', capabilities}) {
    const scenes = snapshot.scenes || [];
    if (scenes.length > 1 && !scenePath) throw new Error('Select a USD physics scene before simulating.');
    const scene = scenePath ? scenes.find(s => s.path === scenePath) : scenes[0];
    if (scenePath && !scene) throw new Error(`USD physics scene not found: ${scenePath}`);
    const mpu = positive(snapshot.metersPerUnit) ? snapshot.metersPerUnit ?? 0.01 : 0.01;
    const kgpu = positive(snapshot.kilogramsPerUnit) ? snapshot.kilogramsPerUnit ?? 1 : 1;
    /** @type {PhysicsIssue[]} */
    const issues = [];
    /** @type {Adaptation[]} */
    const adaptations = [];
    /** @param {{path:string,type?:string}} item @param {string} reason */
    const warn = (item, reason) => { if (!issues.some(issue => issue.path === item.path && issue.reason === reason)) issues.push({path: item.path, type: item.type, reason}); };
    /** @param {{simulationOwners?: string[]}} item */
    const inScene = item => item.simulationOwners?.length ? !!scene && item.simulationOwners.includes(scene.path)
        : !scene || scene.path === scenes[0]?.path;

    /** @type {BodyDescription[]} */
    const bodies = [];
    /** @type {Map<string,PhysicsBody>} */
    const bodyData = new Map();
    for (const data of snapshot.bodies || []) {
        if (!inScene(data)) continue;
        const type = data.rigidBodyEnabled === false ? 'fixed' : data.kinematicBody ? 'kinematic' : 'dynamic';
        bodies.push({id: data.path, type, position: vector(data.position), rotation: rotation(q(data.rotation)),
            linearVelocity: vector(data.linearVelocity),
            angularVelocity: plain(new Vector3().fromArray(data.angularVelocity || [0, 0, 0]).multiplyScalar(Math.PI / 180)),
            sleeping: !!data.startsAsleep, continuousCollision: type === 'dynamic',
            mass: bodyMass(data, mode, kgpu)});
        bodyData.set(data.path, data);
    }

    /** @type {ColliderDescription[]} */
    const colliders = [];
    /** @type {Map<string,ColliderData>} */
    const colliderData = new Map();
    const materials = new Map((snapshot.materials || []).map(m => [m.path, m]));
    for (const data of mode === 'interaction' ? [] : snapshot.shapes || []) {
        if (data.collisionEnabled === false || !inScene(data)) continue;
        const owner = bodyData.get(data.body ?? '');
        if (data.body && !owner) continue;
        /** @type {ShapeDescription} */
        let shape;
        const extraRotation = new Quaternion();
        switch (data.type) {
            case 'cube': if (!data.halfExtents) throw new TypeError('Cube collider requires halfExtents.'); shape = {type: 'box', halfExtents: vector(data.halfExtents)}; break;
            case 'sphere': if (data.radius === undefined) throw new TypeError('Sphere collider requires radius.'); shape = {type: 'sphere', radius: data.radius}; break;
            case 'capsule': case 'cylinder': case 'cone':
                if (data.radius === undefined || data.halfHeight === undefined) throw new TypeError('Collider requires radius and halfHeight.');
                shape = {type: data.type, radius: data.radius, halfHeight: data.halfHeight};
                extraRotation.setFromUnitVectors(new Vector3(0, 1, 0), axis(data.axis));
                break;
            case 'plane':
                if (!capabilities.shapes.has('plane')) { warn(data, `Plane colliders require ${capabilities.backend === 'rapier' ? 'Rapier halfspace' : 'plane collider'} support.`); continue; }
                shape = {type: 'plane', normal: plain(axis(data.axis))}; break;
            case 'mesh': {
                if (data.points !== undefined && !isNumberBuffer(data.points) || data.indices !== undefined && !isNumberBuffer(data.indices)) throw new TypeError('Invalid mesh collision buffers.');
                const points = Float32Array.from(data.points || [], (v, i) => v * (data.meshScale?.[i % 3] ?? 1));
                const indices = Uint32Array.from(data.indices || []);
                if (!points.length) { warn(data, 'Mesh collision points are unavailable.'); continue; }
                if (data.approximation === 'convexHull') shape = {type: 'convexHull', points};
                else if (data.approximation === 'sdf') {
                    if (!capabilities.shapes.has('convexDecomposition')) { warn(data, `SDF-source mesh collision requires ${capabilities.backend === 'rapier' ? 'Rapier ' : ''}convex decomposition support.`); continue; }
                    shape = {type: 'convexDecomposition', points, indices, resolution: 64, concavity: .001, maxHulls: 128};
                    adaptations.push({path: data.path, source: 'sdf', target: 'convex decomposition',
                        reason: 'The authored collision surface is represented by a concave compound of convex parts.'});
                }
                // Preserve authored concave surfaces. A single convex hull would seal drawers and cavities.
                else if (!data.approximation || data.approximation === 'none') shape = {type: 'triangleMesh', points, indices};
                else { warn(data, `Mesh approximation ${data.approximation} is not supported.`); continue; }
                break;
            }
            default: warn(data, 'Collider type is not supported.'); continue;
        }
        if (!capabilities.shapes.has(shape.type)) { warn(data, 'Collider type is not supported.'); continue; }
        const material = data.materials?.map(path => materials.get(path)).find(Boolean);
        const density = positive(data.density) ? data.density ?? 0 : positive(owner?.density) ? owner?.density ?? 0 : material?.density ?? 0;
        /** @type {MassDescription|undefined} */
        let mass = positive(data.mass) ? {mass: (data.mass ?? 0) * kgpu} : undefined;
        if (data.path !== owner?.path && (data.centerOfMass || data.diagonalInertia || data.principalAxes)) {
            // USD authors these in the shape's own frame. Our collider frame also includes
            // the rotation that points the primitive along its axis, so undo that rotation here.
            const inverseShape = extraRotation.clone().invert();
            mass = {...mass,
                ...data.centerOfMass && {centerOfMass: plain(new Vector3().fromArray(data.centerOfMass).multiply(new Vector3().fromArray(data.scale || [1, 1, 1])).applyQuaternion(inverseShape))},
                ...data.diagonalInertia && {inertia: plain(new Vector3().fromArray(data.diagonalInertia).multiplyScalar(kgpu))},
                ...(data.principalAxes || data.diagonalInertia) && {inertiaRotation: rotation(inverseShape.multiply(q(data.principalAxes)))}};
        }
        colliders.push({id: data.path, body: owner?.path, shape, position: vector(data.position), rotation: rotation(q(data.rotation).multiply(extraRotation)),
            friction: material?.dynamicFriction ?? 0.5, restitution: material?.restitution ?? 0,
            density: density > 0 ? density * kgpu : 1000 * mpu ** 3, mass});
        colliderData.set(data.path, {data, owner});
    }

    /** @type {Map<string,string>} */
    const articulationOf = new Map();
    for (const articulation of snapshot.articulations || []) for (const path of articulation.articulatedJoints) articulationOf.set(path, articulation.path);
    /** @type {ArticulationDescription[]} */
    const articulations = (snapshot.articulations || []).map(item => ({id: item.path,
        bodies: item.articulatedBodies.filter(path => bodyData.has(path)), solverIterations: 24}));

    /** @type {JointDescription[]} */
    const joints = [];
    /** @type {Map<string,PhysicsJoint>} */
    const jointData = new Map();
    for (const data of snapshot.joints || []) {
        if (data.jointEnabled === false) continue;
        if (data.body0 && !bodyData.has(data.body0) || data.body1 && !bodyData.has(data.body1)) { warn(data, 'A joint body is outside the selected simulation scene.'); continue; }
        /** @type {JointDescription} */
        const joint = {id: data.path, type: 'fixed', body0: data.body0 || undefined, body1: data.body1 || undefined,
            anchor0: vector(data.position0), rotation0: rotation(q(data.rotation0)), anchor1: vector(data.position1), rotation1: rotation(q(data.rotation1)),
            axis: plain(axis(data.axis)), collisionEnabled: !!data.collisionEnabled};
        const angular = data.type === 'revolute', unit = angular ? Math.PI / 180 : 1;
        if (data.type === 'fixed') joint.type = 'fixed';
        else if (data.type === 'spherical') {
            joint.type = 'spherical';
            // A spherical joint's limit holds its USD cone angles in degrees: lower is coneAngle0Limit and
            // upper is coneAngle1Limit. Negative angles leave that direction unlimited. Backends take one
            // circular cone, so the smaller angle applies.
            const angles = data.limit?.enabled ? [data.limit.lower, data.limit.upper].filter(angle => angle !== null && angle >= 0) : [];
            if (angles.length) {
                if (!capabilities.features.has('sphericalLimits')) { warn(data, 'Spherical joint cone limits are not supported.'); continue; }
                joint.coneLimit = Math.min(.../** @type {number[]} */ (angles)) * Math.PI / 180;
                if (angles.length < 2 || angles[0] !== angles[1])
                    adaptations.push({path: data.path, source: 'elliptical cone limit', target: 'circular cone limit',
                        reason: 'The backend limits spherical joints with a circular cone, so the smaller authored angle applies in every direction.'});
            }
        } else if (data.type === 'revolute' || data.type === 'prismatic') {
            joint.type = data.type;
            if (data.limit?.enabled) joint.limits = {lower: (data.limit.lower ?? -Infinity) * unit, upper: (data.limit.upper ?? Infinity) * unit};
            if (data.drive?.enabled) {
                const d = data.drive, gain = d.acceleration ? 1 : kgpu / unit;
                joint.drive = {model: d.acceleration ? 'acceleration' : 'force', stiffness: d.stiffness * gain, damping: d.damping * gain,
                    targetPosition: d.targetPosition * unit, targetVelocity: d.targetVelocity * unit,
                    ...d.forceLimit != null && Number.isFinite(d.forceLimit) && {maxForce: d.forceLimit * kgpu}};
            }
        } else if (data.type === 'distance' && !data.minEnabled && data.maxEnabled) {
            const distance = data.limit?.upper ?? data.maxDistance;
            if (distance === undefined || distance === null) { warn(data, 'Distance joint requires an upper limit.'); continue; }
            joint.type = 'distance'; joint.maxDistance = distance;
        } else { warn(data, 'Joint type or limits are not supported.'); continue; }
        if (!capabilities.joints.has(joint.type)) { warn(data, 'Joint type or limits are not supported.'); continue; }
        if (Number.isFinite(data.breakForce) || Number.isFinite(data.breakTorque)) {
            if (!capabilities.features.has('jointBreaking')) warn(data, 'Joint breaking thresholds are not supported.');
            else {
                if (Number.isFinite(data.breakForce)) joint.breakForce = /** @type {number} */ (data.breakForce);
                if (Number.isFinite(data.breakTorque)) joint.breakTorque = /** @type {number} */ (data.breakTorque);
            }
        }
        const articulation = articulationOf.get(data.path);
        if (articulation && !data.excludeFromArticulation) joint.articulation = articulation;
        if (data.mimic) {
            if ((capabilities.jointCoupling ?? 'none') === 'none') warn(data, 'Mimic joint coupling is not supported by this physics backend.');
            else {
                // Mimic uses snapshot units (degrees for revolute joints); descriptions use radians.
                const leader = (snapshot.joints || []).find(item => item.path === data.mimic?.joint);
                const followerUnit = unit, leaderUnit = leader?.type === 'revolute' ? Math.PI / 180 : 1;
                joint.coupling = {joint: data.mimic.joint, multiplier: data.mimic.multiplier * followerUnit / leaderUnit, offset: data.mimic.offset * followerUnit};
            }
        }
        joints.push(joint); jointData.set(data.path, data);
    }
    // A follower whose leader was left out follows nothing.
    for (const joint of joints) if (joint.coupling && !joints.some(item => item.id === joint.coupling?.joint && (item.type === 'revolute' || item.type === 'prismatic'))) {
        const data = /** @type {PhysicsJoint} */ (jointData.get(joint.id));
        warn(data, 'The mimic joint\'s leader is not simulated, so it moves freely.');
        delete joint.coupling;
    }

    const groups = new Map((snapshot.groups || []).map(g => [g.path, g]));
    /** @type {Map<string,string>} */
    const groupAliases = new Map();
    for (const group of snapshot.groups || []) for (const path of [group.path, ...(group.mergedGroups || [])]) groupAliases.set(path, group.path);
    /** @param {string} path */
    const canonicalGroup = path => groupAliases.get(path) || path;
    const snapshotArticulations = snapshot.articulations || [];
    const articulationByPath = new Map(snapshotArticulations.map(item => [item.path, item]));
    /** @param {string} path @param {ColliderData} collider */
    const matches = (path, collider) => contains(path, collider.data.path) || path === collider.data.body
        || !!articulationByPath.get(path)?.articulatedBodies.includes(collider.data.body ?? '');
    /** @param {ColliderData} a @param {ColliderData} b */
    const excludes = (a, b) => (a.data.filteredCollisions || []).some(p => matches(p, b))
        || (a.owner?.filteredCollisions || []).some(p => matches(p, b))
        || snapshotArticulations.some(item => item.articulatedBodies.includes(a.data.body ?? '') && item.filteredCollisions.some(p => matches(p, b)));
    /** @param {ColliderData} a @param {ColliderData} b */
    const groupExcludes = (a, b) => (a.data.collisionGroups || []).some(path => {
        const g = groups.get(canonicalGroup(path));
        if (!g) return false;
        const filtered = (b.data.collisionGroups || []).some(other => (g.filteredGroups || []).some(target => canonicalGroup(target) === canonicalGroup(other)));
        return g.invertFilteredGroups ? !filtered : filtered;
    });

    return {scene, metersPerUnit: mpu, kilogramsPerUnit: kgpu, bodies, colliders, joints, articulations,
        bodyData, colliderData, jointData, issues, adaptations,
        shouldCollide(a, b) {
            const c0 = colliderData.get(a), c1 = colliderData.get(b);
            return !(c0 && c1 && (excludes(c0, c1) || excludes(c1, c0) || groupExcludes(c0, c1) || groupExcludes(c1, c0)));
        }};
}

/** Mass overrides for a body. In interaction mode there are no colliders to derive mass from, so we always fill in every value. */
/** @param {PhysicsBody} data @param {'simulation'|'interaction'} mode @param {number} kgpu @returns {MassDescription|undefined} */
function bodyMass(data, mode, kgpu) {
    const authored = positive(data.mass) || data.centerOfMass || data.diagonalInertia || data.principalAxes;
    if (mode !== 'interaction' && !authored) return undefined;
    const centerOfMass = data.centerOfMass ? new Vector3().fromArray(data.centerOfMass).multiply(new Vector3().fromArray(data.scale || [1, 1, 1])) : undefined;
    if (mode !== 'interaction') return {
        ...positive(data.mass) && {mass: (data.mass ?? 0) * kgpu},
        ...centerOfMass && {centerOfMass: plain(centerOfMass)},
        ...data.diagonalInertia && {inertia: plain(new Vector3().fromArray(data.diagonalInertia).multiplyScalar(kgpu))},
        ...data.principalAxes && {inertiaRotation: rotation(q(data.principalAxes))},
    };
    const mass = positive(data.mass) ? (data.mass ?? 0) * kgpu : 1;
    let inertia = data.diagonalInertia ? new Vector3().fromArray(data.diagonalInertia).multiplyScalar(kgpu) : new Vector3().setScalar(mass);
    let frame = new Quaternion();
    if (centerOfMass && !data.diagonalInertia) {
        const shifted = shiftInertiaToCenterOfMass(inertia, frame, mass, new Vector3(), centerOfMass);
        inertia = shifted.diagonalInertia; frame = shifted.principalAxes;
    }
    if (data.principalAxes) frame = q(data.principalAxes);
    return {mass, centerOfMass: plain(centerOfMass || new Vector3()), inertia: plain(inertia), inertiaRotation: rotation(frame)};
}
