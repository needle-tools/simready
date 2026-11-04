/** Measure authored joint coordinates from solved poses, in stage units/degrees. */
/** @param {import('./index.js').PhysicsJoint} data @param {ReadonlyMap<string, {body: import('./kinematics.js').BodyPose}>} bodies */
export function jointValue(data: import("./index.js").PhysicsJoint, bodies: ReadonlyMap<string, {
    body: import("./kinematics.js").BodyPose;
}>): number | null;
