/** Measure scalar rest position and velocity from authored world poses and joint
 * frames. Angular results use degrees; linear results use stage distance units.
 * Full revolutions are ambiguous in a pose, so choose the nearest valid authored
 * turn while retaining the principal angle whenever it is inside the limits.
 * @param {import('./index.js').PhysicsSnapshot} snapshot
 * @param {import('./index.js').PhysicsJoint} joint
 * @returns {{position:number,velocity:number}|null}
 */
export function getUsdJointState(snapshot: import("./index.js").PhysicsSnapshot, joint: import("./index.js").PhysicsJoint): {
    position: number;
    velocity: number;
} | null;
