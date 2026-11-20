// @ts-check
import { Matrix4, Vector3 } from 'three';

/** @typedef {import('./kinematics.js').JointRecord} JointRecord */
/** @typedef {import('./kinematics-types.js').Frame} Frame */

/** @param {Frame} target @param {Frame} source @param {number} scale */
function copyFrame(target, source, scale) {
    const p = source.position, q = source.quaternion;
    target.setPosition(p[0] * scale, p[1] * scale, p[2] * scale);
    target.setQuaternion(q[0], q[1], q[2], q[3]);
}

/** Build a position-only goal at the actual contact on an open serial chain.
 * Closed and coupled components keep the mechanism's constrained joint gesture.
 * @param {import('./kinematics-types.js').KinematicsModule} core
 * @param {Map<string,import('./kinematics.js').BodyRecord>} bodies
 * @param {Map<string,JointRecord>} joints @param {Map<string,JointRecord>} parents
 * @param {number} scale Metres per authored unit. @param {()=>void} sync */
export function pointDragFactory(core, bodies, joints, parents, scale, sync) {
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
        /** @type {{live:JointRecord['joint'], joint:JointRecord['joint'], dof:number, factor:number}[]} */
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
                drives.push({live:edge.joint, joint, dof, factor});
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
        const solver = new Solver(root);
        solver.maxIterations = 8;
        solver.translationConvergeThreshold = 0.00025;

        /** @param {import('three').Vector3Like} position */
        return function move(position) {
            if (!Number.isFinite(position.x) || !Number.isFinite(position.y) || !Number.isFinite(position.z)) return;
            goal.setPosition(position.x * scale, position.y * scale, position.z * scale);
            solver.solve();
            if (drives.some(d => !Number.isFinite(d.joint.getDoFValue(d.dof)))) return;
            let changed = false;
            for (const {joint, live, dof, factor} of drives) {
                const value = joint.getDoFValue(dof) / factor;
                if (Math.abs(live.getDoFValue(dof) - value) < 1e-8) continue;
                live.setDoFValue(dof, value);
                changed = true;
            }
            if (changed) sync();
        };
    };
}
