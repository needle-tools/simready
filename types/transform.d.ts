/** Convert an independent asset into a host world's coordinates and units. */
/** @param {import('./index.js').PhysicsSnapshot} source
 * @param {{metersPerUnit?: number, kilogramsPerUnit?: number, position?: import('./index.js').PhysicsVector, rotation?: import('./index.js').PhysicsRotation}} [options]
 */
export function transformSnapshot(source: import("./index.js").PhysicsSnapshot, { metersPerUnit, kilogramsPerUnit, position, rotation }?: {
    metersPerUnit?: number;
    kilogramsPerUnit?: number;
    position?: import("./index.js").PhysicsVector;
    rotation?: import("./index.js").PhysicsRotation;
}): import("./index.js").PhysicsSnapshot;
