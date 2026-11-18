/**
 * Choose the equivalent authored turn without changing the measured pose.
 * Snapshots without a turn reference keep their existing limit-based branch.
 * @param {number} degrees @param {import('./index.js').PhysicsJoint} joint
 */
export function authoredAngle(degrees: number, joint: import("./index.js").PhysicsJoint): number;
/** Measure authored joint coordinates from solved poses, in stage units/degrees. */
/** @param {import('./index.js').PhysicsJoint} data @param {ReadonlyMap<string, {body: import('./kinematics.js').BodyPose}>} bodies */
export function jointValue(data: import("./index.js").PhysicsJoint, bodies: ReadonlyMap<string, {
    body: import("./kinematics.js").BodyPose;
}>): number | null;
