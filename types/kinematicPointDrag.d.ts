/** Build a position-only goal at the actual contact on an open serial chain.
 * Closed and coupled components keep the mechanism's constrained joint gesture.
 * @param {import('./kinematics-types.js').KinematicsModule} core
 * @param {Map<string,import('./kinematics.js').BodyRecord>} bodies
 * @param {Map<string,JointRecord>} joints @param {Map<string,JointRecord>} parents
 * @param {number} scale Metres per authored unit. @param {()=>void} sync */
export function pointDragFactory(core: import("./kinematics-types.js").KinematicsModule, bodies: Map<string, import("./kinematics.js").BodyRecord>, joints: Map<string, JointRecord>, parents: Map<string, JointRecord>, scale: number, sync: () => void): (path: string, point: import("three").Vector3Like) => ((position: import("three").Vector3Like) => void) | null;
export type JointRecord = import("./kinematics.js").JointRecord;
export type Frame = import("./kinematics-types.js").Frame;
