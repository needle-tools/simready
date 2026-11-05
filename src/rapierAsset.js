// @ts-check
/** @typedef {import('./rapier-types.js').RigidBody} RigidBody */
/** @typedef {import('./rapier-types.js').Collider} Collider */
/** @typedef {import('./rapier-types.js').Joint} Joint */
/** @typedef {import('./rapier-types.js').Vector} Vector */
/** @typedef {import('./description.js').SimulationDescription} SimulationDescription */
/** @typedef {import('./description.js').MassDescription} MassDescription */
/** @template {RigidBody} [B=RigidBody]
 * @typedef {import('./rapier-types.js').World<B>} World */
/** @template {RigidBody} [B=RigidBody]
 * @template {World<B>} [W=World<B>]
 * @typedef {import('./rapier-types.js').RapierModule<B,W>} RapierModule */
/** @template B
 * @typedef {{
 * bodies:Map<string,B>,colliders:Map<string,Collider>,joints:Map<string,Joint>,
 * jointSolver:'impulse'|'hybrid',adaptations:import('./description.js').Adaptation[],
 * ownedBodies:Set<B>,ownedColliders:Set<Collider>,
 * setDriveTarget(path:string,position:number,velocity:number):boolean,
 * hold():void,release():void,
 * beginDrag(body:B,position:Vector,local:Vector,stiffness:number,damping:number):{move(position:Vector):void,end():void},
 * pin(body:B):()=>void,
 * updateCouplings():void,
 * remove():void
 * }} RapierAsset */

import {Quaternion, Vector3} from 'three';
import {shiftInertiaToCenterOfMass} from './massProperties.js';

/** The drive a coupled joint uses when it has none: stiff and critically damped, independent of mass. */
/** @type {import('./description.js').DriveDescription} */
const couplingDrive = {model: 'acceleration', stiffness: 2000, damping: 2 * Math.sqrt(2000), targetPosition: 0, targetVelocity: 0};

/**
 * A revolute joint's angle (radians) or a prismatic joint's slide distance, measured from the
 * bodies' poses and the joint frames. Needle Engine's backends measure it the same way.
 * @param {import('./description.js').JointDescription} joint @param {RigidBody} body0 @param {RigidBody} body1
 */
function jointPosition(joint, body0, body1) {
    const axis = new Vector3().copy(joint.axis).normalize();
    const frame0 = quat(body0.rotation()).multiply(quat(joint.rotation0)), frame1 = quat(body1.rotation()).multiply(quat(joint.rotation1));
    if (joint.type === 'revolute') {
        const relative = frame0.clone().invert().multiply(frame1);
        return 2 * Math.atan2(new Vector3(relative.x, relative.y, relative.z).dot(axis), relative.w);
    }
    const anchor0 = new Vector3().copy(joint.anchor0).applyQuaternion(quat(body0.rotation())).add(body0.translation());
    const anchor1 = new Vector3().copy(joint.anchor1).applyQuaternion(quat(body1.rotation())).add(body1.translation());
    return anchor1.sub(anchor0).dot(axis.applyQuaternion(frame0));
}

/** @param {Vector|undefined} value */
const vec = value => ({x: value?.x ?? 0, y: value?.y ?? 0, z: value?.z ?? 0});
/** @param {import('./description.js').Rotation|undefined} value */
const quat = value => new Quaternion(value?.x ?? 0, value?.y ?? 0, value?.z ?? 0, value?.w ?? 1);

/**
 * Create the bodies, colliders and joints of a description in a Rapier world.
 * The standalone adapter uses this builder. The Needle adapter passes the same description to Engine's createAsset.
 */
/** @template {RigidBody} B
 * @template {World<B>} W
 * @param {{rapier:RapierModule<B,W>,world:W,description:SimulationDescription,warn:(item:{path:string,type?:string},reason:string)=>void}} options
 * @returns {RapierAsset<B>}
 */
export function buildRapierAsset({rapier: R, world, description, warn}) {
    /** @type {Set<B>} */
    const ownedBodies = new Set();
    /** @type {Set<Collider>} */
    const ownedColliders = new Set();
    /** @type {Set<Joint>} */
    const ownedJoints = new Set();
    /** @type {Set<Joint>} */
    const ownedMultibodyJoints = new Set();
    /** @type {Map<string,B>} */
    const bodies = new Map();
    /** @type {Map<string,Collider>} */
    const colliders = new Map();
    /** @type {Map<string,Joint>} */
    const joints = new Map();
    /** @type {Map<string,{model:'force'|'acceleration',stiffness:number,damping:number}>} */
    const drives = new Map();
    /** @type {Map<string,[B,B]>} */
    const jointBodies = new Map();
    /** @type {import('./description.js').Adaptation[]} */
    const adaptations = description.articulations.map(articulation => ({
        path: articulation.id, source: 'reduced-coordinate articulation', target: 'impulse constraints',
        reason: 'Authored links, joint frames, limits, drives and collision filters are retained in the impulse solver.',
    }));
    /** @type {'impulse'|'hybrid'} */
    let jointSolver = 'impulse';
    /** @param {import('./rapier-types.js').RigidBodyDescriptor} desc */
    const makeBody = desc => { const body = world.createRigidBody(desc); ownedBodies.add(body); return body; };
    const remove = () => {
        for (const joint of ownedMultibodyJoints) if (world.multibodyJoints.contains(joint.handle)) world.removeMultibodyJoint(joint, true);
        for (const joint of ownedJoints) if (world.impulseJoints.contains(joint.handle)) world.removeImpulseJoint(joint, true);
        for (const body of ownedBodies) if (world.bodies.contains(body.handle)) world.removeRigidBody(body);
        for (const collider of ownedColliders) if (world.colliders.contains(collider.handle)) world.removeCollider(collider, true);
    };
    /** @type {Map<number,number>} */
    const fixedParents = new Map();
    /** @param {number} handle */
    const fixedRoot = handle => { let parent; while ((parent = fixedParents.get(handle)) !== undefined) handle = parent; return handle; };
    try {
        for (const item of description.bodies) {
            const desc = item.type === 'fixed' ? R.RigidBodyDesc.fixed() : item.type === 'kinematic' ? R.RigidBodyDesc.kinematicPositionBased() : R.RigidBodyDesc.dynamic();
            desc.setTranslation(item.position.x, item.position.y, item.position.z).setRotation(item.rotation);
            desc.setLinvel(item.linearVelocity.x, item.linearVelocity.y, item.linearVelocity.z);
            desc.setAngvel(item.angularVelocity);
            desc.setSleeping(item.sleeping);
            if (item.continuousCollision) desc.setCcdEnabled(true);
            bodies.set(item.id, makeBody(desc));
        }
        /** @type {Map<string,Collider[]>} */
        const bodyColliders = new Map();
        for (const item of description.colliders) {
            const shape = item.shape, owner = item.body !== undefined ? bodies.get(item.body) : undefined;
            const data = description.colliderData.get(item.id)?.data ?? {path: item.id};
            let desc;
            switch (shape.type) {
                case 'box': desc = R.ColliderDesc.cuboid(shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z); break;
                case 'sphere': desc = R.ColliderDesc.ball(shape.radius); break;
                case 'capsule': case 'cylinder': case 'cone': desc = R.ColliderDesc[shape.type](shape.halfHeight, shape.radius); break;
                case 'plane': desc = R.ColliderDesc.halfspace?.(vec(shape.normal)); break;
                case 'convexHull': desc = R.ColliderDesc.convexHull(shape.points); break;
                case 'convexDecomposition': desc = R.ColliderDesc.convexDecomposition?.(shape.points, shape.indices,
                    {resolution: shape.resolution ?? 64, concavity: shape.concavity ?? .001, maxConvexHulls: shape.maxHulls ?? 128}, R.CompoundFlags?.FIX_INTERNAL_EDGES ?? 1); break;
                case 'triangleMesh': desc = R.ColliderDesc.trimesh(shape.points, shape.indices, R.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED); break;
            }
            if (!desc) { warn(data, 'Collider could not be constructed.'); continue; }
            desc.setFriction(item.friction).setRestitution(item.restitution);
            desc.setDensity(item.density);
            const mass = item.mass;
            if ((mass?.mass ?? 0) > 0) desc.setMass(mass?.mass ?? 0);
            if (mass && (mass.centerOfMass || mass.inertia || mass.inertiaRotation)) {
                // Probe the shape in its own frame to fill unauthored moments.
                // The temporary body never participates in a simulation step.
                const complete = (mass.mass ?? 0) > 0 && mass.centerOfMass && mass.inertia;
                const probe = complete ? null : makeBody(R.RigidBodyDesc.dynamic());
                const requireProbe = () => { if (!probe) throw new Error('Incomplete collider mass properties.'); return probe; };
                try {
                    if (probe) { world.createCollider(desc, probe); probe.recomputeMassPropertiesFromColliders(); }
                    const total = complete ? mass.mass ?? 0 : requireProbe().mass();
                    const center = mass.centerOfMass ? new Vector3().copy(mass.centerOfMass) : requireProbe().localCom();
                    let inertia = mass.inertia ? new Vector3().copy(mass.inertia) : requireProbe().principalInertia();
                    let frame = mass.inertia || mass.inertiaRotation ? quat(mass.inertiaRotation) : requireProbe().principalInertiaLocalFrame();
                    if (mass.centerOfMass && !mass.inertia) {
                        const shifted = shiftInertiaToCenterOfMass(inertia, frame, total, requireProbe().localCom(), center);
                        inertia = shifted.diagonalInertia; frame = shifted.principalAxes;
                    }
                    desc.setMassProperties(total, center, inertia, frame);
                } finally { if (probe) { world.removeRigidBody(probe); ownedBodies.delete(probe); } }
            }
            desc.setTranslation(item.position.x, item.position.y, item.position.z).setRotation(item.rotation);
            desc.setActiveHooks(R.ActiveHooks.FILTER_CONTACT_PAIRS);
            const collider = world.createCollider(desc, owner); ownedColliders.add(collider);
            colliders.set(item.id, collider);
            if (item.body !== undefined) bodyColliders.set(item.body, [...bodyColliders.get(item.body) || [], collider]);
        }
        for (const item of description.bodies) {
            const body = bodies.get(item.id), mass = item.mass;
            if (!body) continue;
            body.recomputeMassPropertiesFromColliders();
            if (!mass) continue;
            const derived = body.mass(), total = (mass.mass ?? 0) > 0 ? mass.mass ?? 0 : derived;
            let inertia = mass.inertia ? new Vector3().copy(mass.inertia)
                : new Vector3().copy(body.principalInertia()).multiplyScalar(derived > 0 ? total / derived : 1);
            const center = mass.centerOfMass ? new Vector3().copy(mass.centerOfMass) : body.localCom();
            let frame = body.principalInertiaLocalFrame();
            if (mass.centerOfMass && !mass.inertia) {
                const shifted = shiftInertiaToCenterOfMass(inertia, frame, total, body.localCom(), center);
                inertia = shifted.diagonalInertia; frame = shifted.principalAxes;
            }
            if (mass.inertiaRotation) frame = mass.inertiaRotation;
            for (const collider of bodyColliders.get(item.id) || []) collider.setDensity(0);
            body.setAdditionalMassProperties(total, center, inertia, frame, false);
            body.recomputeMassPropertiesFromColliders();
        }
        for (const articulation of description.articulations) for (const path of articulation.bodies)
            bodies.get(path)?.setAdditionalSolverIterations(Math.max(0, articulation.solverIterations - world.numSolverIterations));
        const fixedWorld = makeBody(R.RigidBodyDesc.fixed());
        for (const item of description.joints) {
            const data = description.jointData.get(item.id) ?? {path: item.id, type: item.type};
            const b0 = item.body0 !== undefined ? bodies.get(item.body0) : fixedWorld;
            const b1 = item.body1 !== undefined ? bodies.get(item.body1) : fixedWorld;
            if (!b0 || !b1) { warn(data, 'A joint body is outside the selected simulation scene.'); continue; }
            const a0 = vec(item.anchor0), a1 = vec(item.anchor1), r0 = item.rotation0, r1 = item.rotation1;
            const unit = item.type === 'revolute' || item.type === 'prismatic';
            let desc;
            if (item.type === 'fixed') desc = R.JointData.fixed(a0, r0, a1, r1);
            else if (item.type === 'spherical') desc = R.JointData.spherical(a0, a1);
            else if (unit) {
                // Rapier's public unit-joint API accepts a shared local axis/frame.
                // Never discard independently authored frames or their limit origin.
                if ((!R.ImpulseJoint?.prototype.setLocalFrame1 || !R.ImpulseJoint?.prototype.setLocalFrame2) && (quat(r0).angleTo(quat(r1)) > 1e-5 ||
                    (item.type === 'prismatic' && quat(r0).angleTo(new Quaternion()) > 1e-5))) {
                    warn(data, 'Independent joint frame rotations are not supported by this Rapier adapter.'); continue;
                }
                const jointAxis = new Vector3().copy(item.axis).applyQuaternion(quat(r0));
                desc = item.type === 'revolute' ? R.JointData.revolute(a0, a1, jointAxis) : R.JointData.prismatic(a0, a1, jointAxis);
            } else if (item.type === 'distance') desc = R.JointData.rope(item.maxDistance ?? 0, a0, a1);
            else if (item.type === 'spring' && item.spring) desc = R.JointData.spring(item.spring.restLength ?? 0, item.spring.stiffness, item.spring.damping, a0, a1);
            else { warn(data, 'Joint type or limits are not supported.'); continue; }
            const root0 = fixedRoot(b0.handle), root1 = fixedRoot(b1.handle);
            const reducedFixed = item.type === 'fixed' && item.articulation !== undefined && root0 !== root1
                && (root0 === b0.handle || root1 === b1.handle);
            let joint;
            if (reducedFixed) {
                // Rapier can attach a child tree only through its root. Joining
                // two internal links stays an impulse constraint; reverse a
                // root-to-internal edge to retain the valid reduced-coordinate tree.
                const reverse = root1 !== b1.handle;
                joint = reverse ? world.createMultibodyJoint(R.JointData.fixed(a1, r1, a0, r0), b1, b0, true)
                    : world.createMultibodyJoint(desc, b0, b1, true);
                ownedMultibodyJoints.add(joint); fixedParents.set(reverse ? root0 : root1, reverse ? root1 : root0);
                jointSolver = 'hybrid';
            } else {
                joint = world.createImpulseJoint(desc, b0, b1, true); ownedJoints.add(joint);
                if (item.type === 'fixed' && item.articulation !== undefined)
                    adaptations.push({path: item.id, source: 'reduced-coordinate fixed link', target: 'fixed impulse constraint',
                        reason: root0 === root1 ? 'The fixed constraint closes a reduced-coordinate loop.'
                            : 'The fixed constraint connects internal links of two reduced-coordinate trees.'});
            }
            if (unit && joint.setLocalFrame1 && joint.setLocalFrame2) {
                // Rapier unit joints use X in their local frame. Rotate that
                // basis into the authored axis, then apply each local frame.
                const basis = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), new Vector3().copy(item.axis).normalize());
                joint.setLocalFrame1(a0, quat(r0).multiply(basis));
                joint.setLocalFrame2(a1, quat(r1).multiply(basis));
            }
            joint.setContactsEnabled(item.collisionEnabled);
            if (item.limits && joint.setLimits) joint.setLimits(item.limits.lower, item.limits.upper);
            // A coupled joint follows its leader with a drive. Without an authored drive it gets a stiff one.
            const drive = item.drive ?? (item.coupling ? couplingDrive : undefined);
            if (drive && joint.configureMotor) {
                if (drive.maxForce !== undefined) {
                    if (joint.setMotorMaxForce) joint.setMotorMaxForce(drive.maxForce);
                    else warn(data, 'Drive force limits are not supported by this Rapier version.');
                }
                if (joint.configureMotorModel) joint.configureMotorModel(drive.model === 'acceleration' ? R.MotorModel.AccelerationBased : R.MotorModel.ForceBased);
                else warn(data, 'Drive motor modes are not supported by this Rapier version.');
                joint.configureMotor(drive.targetPosition, drive.targetVelocity, drive.stiffness, drive.damping);
                drives.set(item.id, drive);
            }
            joints.set(item.id, joint);
            jointBodies.set(item.id, [b0, b1]);
        }
        if (jointSolver === 'hybrid') for (const item of adaptations) if (item.source === 'reduced-coordinate articulation') {
            item.target = 'reduced-coordinate fixed links with impulse motion joints';
            item.reason = 'Fixed links use reduced coordinates; authored movable joint frames, limits, drives and collision filters use impulse constraints.';
        }
    } catch (error) { remove(); throw error; }

    // Couplings: after each step, drive the follower toward the leader's position × multiplier + offset.
    /** @type {Array<{follower:string,leader:import('./description.js').JointDescription,coupling:{joint:string,multiplier:number,offset:number},target:number}>} */
    const couplings = [];
    for (const item of description.joints) {
        const leader = item.coupling && description.joints.find(joint => joint.id === item.coupling?.joint);
        if (!item.coupling || !leader || !joints.has(item.id) || !jointBodies.has(leader.id)) continue;
        couplings.push({follower: item.id, leader, coupling: item.coupling, target: NaN});
        adaptations.push({path: item.id, source: 'joint coupling', target: "drive toward the leader's position",
            reason: 'Rapier has no gear or mimic constraint, so the follower is driven toward the leader after each step and lags slightly under load.'});
    }
    const updateCouplings = () => {
        // Rapier's sleep threshold can exceed a commanded motor speed. Keep powered
        // endpoints awake while velocity is requested; a stopped motor may sleep normally.
        for (const [path, drive] of drives) if (drive.targetVelocity !== 0) {
            for (const body of jointBodies.get(path) || [])
                if (world.bodies.contains(body.handle) && body.isDynamic()) body.wakeUp();
        }
        for (const coupling of couplings) {
            const [body0, body1] = /** @type {[B,B]} */ (jointBodies.get(coupling.leader.id));
            if (!world.bodies.contains(body0.handle) || !world.bodies.contains(body1.handle)) continue;
            const target = jointPosition(coupling.leader, body0, body1) * coupling.coupling.multiplier + coupling.coupling.offset;
            // Changing the target wakes the bodies, so only send real changes and let the mechanism sleep.
            if (Math.abs(target - coupling.target) < 1e-5) continue;
            coupling.target = target;
            const joint = joints.get(coupling.follower), drive = drives.get(coupling.follower);
            if (joint?.configureMotor && drive) joint.configureMotor(target, 0, drive.stiffness, drive.damping);
        }
    };
    updateCouplings();

    /** @type {Map<B,{type:number,linear:Vector,angular:Vector,nextPosition:Vector,nextRotation:import('./rapier-types.js').Rotation,sleeping:boolean,enabled:boolean}>|null} */
    let held = null;
    return {
        bodies, colliders, joints, adaptations, ownedBodies, ownedColliders,
        get jointSolver() { return jointSolver; },
        setDriveTarget(path, position, velocity) {
            const joint = joints.get(path), drive = drives.get(path);
            if (!joint?.configureMotor || !drive) return false;
            joint.configureMotor(position, velocity, drive.stiffness, drive.damping);
            drives.set(path, {...drive, targetPosition: position, targetVelocity: velocity});
            return true;
        },
        hold() {
            if (held) return;
            held = new Map([...ownedBodies].map(body => [body, {
                type: body.bodyType(), linear: body.linvel(), angular: body.angvel(),
                nextPosition: body.nextTranslation(), nextRotation: body.nextRotation(),
                enabled: body.isEnabled(), sleeping: body.isSleeping(),
            }]));
            // Rapier requires reduced-coordinate descendants to remain dynamic.
            // Freezing each fixed chain's root holds the complete rigid cluster
            // while retaining its colliders and both kinds of joint handles.
            for (const body of ownedBodies) {
                if (fixedRoot(body.handle) === body.handle) body.setBodyType(R.RigidBodyType.Fixed, false);
                body.setLinvel(vec(undefined), false); body.setAngvel(vec(undefined), false);
            }
        },
        release() {
            if (!held) return;
            const states = held; held = null;
            for (const [body, state] of states) body.setBodyType(state.type, false);
            for (const [body, state] of states) {
                body.setLinvel(state.linear, false); body.setAngvel(state.angular, false);
                body.setNextKinematicTranslation(state.nextPosition); body.setNextKinematicRotation(state.nextRotation);
                body.setEnabled(state.enabled);
                if (state.sleeping) body.sleep(); else body.wakeUp();
            }
        },
        beginDrag(body, position, local, stiffness, damping) {
            const anchor = world.createRigidBody(R.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z));
            const joint = world.createImpulseJoint(R.JointData.spring(0, stiffness, damping, local, vec(undefined)), body, anchor, true);
            return {
                move(next) { anchor.setNextKinematicTranslation(next); },
                end() { world.removeImpulseJoint(joint, true); world.removeRigidBody(anchor); },
            };
        },
        pin(body) {
            const type = body.bodyType();
            body.setBodyType(R.RigidBodyType.Fixed, true);
            return () => { body.setBodyType(type, true); body.setLinvel(vec(undefined), true); body.setAngvel(vec(undefined), true); };
        },
        updateCouplings,
        remove() { held = null; remove(); },
    };
}
