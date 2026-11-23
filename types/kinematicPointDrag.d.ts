/** @typedef {{masses:Map<string,import('./massProperties.js').BodyMassProperties>,kilograms:number,
 * jointAxis:(record:JointRecord)=>{pivot:Vector3,axis:Vector3}}} DragDynamics */
/** Moment of everything a joint carries about its degree of freedom, in SI units: kg·m² about a
 * hinge axis, kg along a slider.
 * @param {JointRecord} edge @param {Map<string,import('./kinematics.js').BodyRecord>} bodies
 * @param {Map<string,JointRecord>} parents @param {number} scale @param {DragDynamics} dynamics */
export function effectiveInertia(edge: JointRecord, bodies: Map<string, import("./kinematics.js").BodyRecord>, parents: Map<string, JointRecord>, scale: number, dynamics: DragDynamics): number;
/** A drive's force limit in SI units (N·m for hinges, N for sliders), or Infinity when it has none.
 * An acceleration drive's limit is an acceleration, so it scales with the inertia it moves.
 * @param {import('./index.js').PhysicsDrive} drive @param {boolean} angular @param {number} inertia
 * @param {number} scale @param {number} kilograms */
export function driveForceLimit(drive: import("./index.js").PhysicsDrive, angular: boolean, inertia: number, scale: number, kilograms: number): number;
/** Build a position-only goal at the actual contact on an open serial chain.
 * Closed and coupled components keep the mechanism's constrained joint gesture.
 * With `dynamics` and a solver that supports degree of freedom weights, lighter joints
 * move first. The pointer always wins: drives act on the pose after release (see kinematics.js).
 * @param {import('./kinematics-types.js').KinematicsModule} core
 * @param {Map<string,import('./kinematics.js').BodyRecord>} bodies
 * @param {Map<string,JointRecord>} joints @param {Map<string,JointRecord>} parents
 * @param {number} scale Metres per authored unit. @param {()=>void} sync @param {DragDynamics} [dynamics] */
export function pointDragFactory(core: import("./kinematics-types.js").KinematicsModule, bodies: Map<string, import("./kinematics.js").BodyRecord>, joints: Map<string, JointRecord>, parents: Map<string, JointRecord>, scale: number, sync: () => void, dynamics?: DragDynamics): (path: string, point: import("three").Vector3Like) => (((position: import("three").Vector3Like) => void) & {
    edges: import("./kinematics.js").JointRecord[];
}) | null;
export type JointRecord = import("./kinematics.js").JointRecord;
export type Frame = import("./kinematics-types.js").Frame;
export type DragDynamics = {
    masses: Map<string, import("./massProperties.js").BodyMassProperties>;
    kilograms: number;
    jointAxis: (record: JointRecord) => {
        pivot: Vector3;
        axis: Vector3;
    };
};
import { Vector3 } from 'three';
