// @ts-check
import { Matrix4, Quaternion, Vector3 } from 'three';

/** @typedef {import('./kinematics.js').JointRecord} JointRecord */
/** @typedef {import('./kinematics-types.js').Frame} Frame */

/** @param {Frame} target @param {Frame} source @param {number} scale */
function copyFrame(target, source, scale) {
    const p = source.position, q = source.quaternion;
    target.setPosition(p[0] * scale, p[1] * scale, p[2] * scale);
    target.setQuaternion(q[0], q[1], q[2], q[3]);
}

/** @typedef {{masses:Map<string,import('./massProperties.js').BodyMassProperties>,kilograms:number,
 * jointAxis:(record:JointRecord)=>{pivot:Vector3,axis:Vector3}}} DragDynamics */


/** Moment of everything a joint carries about its degree of freedom, in SI units: kg·m² about a
 * hinge axis, kg along a slider.
 * @param {JointRecord} edge @param {Map<string,import('./kinematics.js').BodyRecord>} bodies
 * @param {Map<string,JointRecord>} parents @param {number} scale @param {DragDynamics} dynamics */
export function effectiveInertia(edge, bodies, parents, scale, dynamics) {
    const {pivot, axis} = dynamics.jointAxis(edge);
    let total = 0;
    for (const [path, item] of bodies) {
        let carried = path === edge.child;
        for (let up = parents.get(path); up && !carried; up = parents.get(up.parent)) carried = up === edge;
        const mass = carried && dynamics.masses.get(path);
        if (!mass) continue;
        const kilograms = mass.mass * dynamics.kilograms;
        if (!edge.angular) { total += kilograms; continue; }
        const rotation = item.rotation.clone().multiply(new Quaternion(...mass.principalAxes));
        const local = axis.clone().applyQuaternion(rotation.invert());
        const [x, y, z] = mass.diagonalInertia;
        const center = new Vector3(...mass.centerOfMass).applyQuaternion(item.rotation).add(item.position);
        const arm = center.sub(pivot).cross(axis).length() * scale;
        total += (x * local.x ** 2 + y * local.y ** 2 + z * local.z ** 2) * dynamics.kilograms * scale ** 2 + kilograms * arm ** 2;
    }
    return total;
}

/** A drive's force limit in SI units (N·m for hinges, N for sliders), or Infinity when it has none.
 * An acceleration drive's limit is an acceleration, so it scales with the inertia it moves.
 * @param {import('./index.js').PhysicsDrive} drive @param {boolean} angular @param {number} inertia
 * @param {number} scale @param {number} kilograms */
export function driveForceLimit(drive, angular, inertia, scale, kilograms) {
    const limit = drive.forceLimit;
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit < 0) return Infinity;
    return drive.acceleration ? limit * (angular ? Math.PI / 180 : scale) * inertia : limit * kilograms * scale ** (angular ? 2 : 1);
}

/** Build a position-only goal at the actual contact on an open serial chain.
 * Closed and coupled components keep the mechanism's constrained joint gesture.
 * With `dynamics` and a solver that supports degree of freedom weights, lighter joints
 * move first. The pointer always wins: drives act on the pose after release (see kinematics.js).
 * @param {import('./kinematics-types.js').KinematicsModule} core
 * @param {Map<string,import('./kinematics.js').BodyRecord>} bodies
 * @param {Map<string,JointRecord>} joints @param {Map<string,JointRecord>} parents
 * @param {number} scale Metres per authored unit. @param {()=>void} sync @param {DragDynamics} [dynamics] */
export function pointDragFactory(core, bodies, joints, parents, scale, sync, dynamics) {
    const {Link, Joint, Goal, Solver, DOF} = core;
    if (!Goal) throw new TypeError('Point dragging requires a kinematics module with Goal.');

    /** World-attached branches can move independently even though they share the world frame.
     * @param {string} path */
    function component(path) {
        for (let edge = parents.get(path); edge?.parent; edge = parents.get(path)) path = edge.parent;
        return path;
    }
    const constrained = new Set();
    for (const edge of joints.values()) {
        if (edge.closure || edge.data.mimic) {
            constrained.add(component(edge.parent));
            constrained.add(component(edge.child));
            const driver = edge.data.mimic && joints.get(edge.data.mimic.joint);
            if (driver) constrained.add(component(driver.child));
        }
    }
    /** @param {string} path @param {import('three').Vector3Like} point */
    return function begin(path, point) {
        if (constrained.has(component(path))) return null;
        const chain = [];
        for (let edge = parents.get(path); edge; edge = parents.get(edge.parent)) chain.push(edge);
        if (chain.filter(edge => edge.dof !== null && edge.lower < edge.upper).length < 2 ||
            chain.some(edge => edge.data.type === 'spherical')) return null;
        chain.reverse();

        // Work in metres, preserving corrected rest frames and signed traversal
        // coordinates from the live mechanism, including a reversed world attachment.
        const root = new Link(), base = bodies.get(chain[0].parent);
        if (base) {
            const {position:p, rotation:q} = base;
            root.setPosition(p.x * scale, p.y * scale, p.z * scale);
            root.setQuaternion(q.x, q.y, q.z, q.w);
        }
        let parent = root;
        /** @type {{edge:JointRecord, live:JointRecord['joint'], joint:JointRecord['joint'],
         * dof:number, factor:number, min:number, max:number}[]} */
        const drives = [];
        for (const edge of chain) {
            const joint = new Joint(), link = new Link(), body = bodies.get(edge.child);
            if (!body) return null;
            copyFrame(joint, edge.joint, scale);
            copyFrame(link, body.link, scale);
            const dof = edge.dof;
            if (dof !== null) {
                const factor = edge.angular ? 1 : scale;
                joint.setDoF(dof);
                joint.setMinLimit(dof, edge.joint.minDoFLimit[dof] * factor);
                joint.setMaxLimit(dof, edge.joint.maxDoFLimit[dof] * factor);
                joint.setDoFValue(dof, edge.joint.getDoFValue(dof) * factor);
                drives.push({
                    edge, live:edge.joint, joint, dof, factor,
                    min:joint.minDoFLimit[dof], max:joint.maxDoFLimit[dof],
                });
            }
            parent.addChild(joint);
            joint.addChild(link);
            parent = link;
        }
        const grabbed = bodies.get(path);
        if (!grabbed) return null;
        const offset = new Vector3().copy(point)
            .applyMatrix4(new Matrix4().fromArray(grabbed.link.matrixWorld).invert()).multiplyScalar(scale);
        const mount = new Joint(), tip = new Link(), goal = new Goal();
        mount.setPosition(offset.x, offset.y, offset.z);
        parent.addChild(mount);
        mount.addChild(tip);
        goal.setGoalDoF(DOF.X, DOF.Y, DOF.Z);
        goal.setPosition(point.x * scale, point.y * scale, point.z * scale);
        goal.makeClosure(tip);
        if (dynamics && drives.length && drives.every(({joint}) => joint.dofWeights instanceof Float32Array)) {
            const inertia = drives.map(({edge}) => effectiveInertia(edge, bodies, parents, scale, dynamics));
            const mean = inertia.reduce((sum, value) => sum + value, 0) / inertia.length;
            for (const [i, {joint, dof}] of drives.entries()) {
                const {dofWeights} = joint;
                if (dofWeights && mean > 0 && inertia[i] > 0) dofWeights[dof] = inertia[i] / mean;
            }
        }
        const solver = new Solver(root);
        solver.dampingFactor = 0.05;
        solver.divergeThreshold = 0;
        // A clamped residual is flat while the target is further away than the clamp.
        // Place the goal along the ray from the gripped point to the pointer instead, so the
        // line search measures real progress and the solve stays near the current pose.
        solver.translationErrorClamp = Infinity;
        const reach = Math.max(0, ...chain.filter(edge => edge.angular && edge.dof !== null && edge.lower < edge.upper)
            .map(edge => new Vector3().setFromMatrixPosition(new Matrix4().fromArray(edge.joint.matrixWorld)).distanceTo(point)));
        const maxPull = reach > 0 ? .1 * reach * scale : Infinity;
        solver.maxIterations = 8;
        solver.translationConvergeThreshold = Math.min(0.00025, maxPull / 10);
        const contact = new Vector3(), target = new Vector3(), tipMatrix = new Matrix4();
        const previous = new Float64Array(drives.length);

        /** @param {import('three').Vector3Like} position */
        const move = function move(position) {
            if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) return;
            tip.updateMatrixWorld();
            contact.setFromMatrixPosition(tipMatrix.fromArray(tip.matrixWorld));
            target.copy(position).multiplyScalar(scale).sub(contact).clampLength(0, maxPull).add(contact);
            goal.setPosition(target.x, target.y, target.z);
            // A small tip displacement can still admit a large joint rotation near a
            // singularity. Keep every solve in a joint-space box around the last pose.
            for (const [index, {edge, joint, dof, min, max}] of drives.entries()) {
                const value = previous[index] = joint.getDoFValue(dof);
                const step = edge.angular ? 0.1 : maxPull;
                joint.setMinLimit(dof, Math.max(min, value - step));
                joint.setMaxLimit(dof, Math.min(max, value + step));
            }
            try {
                solver.solve();
            } finally {
                for (const {joint, dof, min, max} of drives) {
                    joint.setMinLimit(dof, min);
                    joint.setMaxLimit(dof, max);
                }
            }
            if (drives.some(({joint, dof}) => !Number.isFinite(joint.getDoFValue(dof)))) {
                for (const [index, {joint, dof}] of drives.entries()) joint.setDoFValue(dof, previous[index]);
                return;
            }
            let changed = false;
            for (const {joint, live, dof, factor} of drives) {
                const value = joint.getDoFValue(dof) / factor;
                if (Math.abs(live.getDoFValue(dof) - value) < 1e-8) continue;
                live.setDoFValue(dof, value);
                changed = true;
            }
            if (changed) sync();
        };
        return Object.assign(move, {edges: drives.map(({edge}) => edge)});
    };
}
