/** Convert a runtime physics descriptor to glTF metres, kilograms, Y-up and radians.
 * Collision points remain available until the producer writes their glTF meshes.
 * @param {import('../index.js').PhysicsSnapshot} source
 * @returns {import('../index.js').GltfPhysicsSnapshot}
 */
export function toGltfPhysicsSnapshot(source: import("../index.js").PhysicsSnapshot): import("../index.js").GltfPhysicsSnapshot;
/** Adapt glTF data to the runtime APIs, whose angular controls use degrees.
 * @param {import('../index.js').GltfPhysicsSnapshot} source
 * @returns {import('../index.js').PhysicsSnapshot}
 */
export function fromGltfPhysicsSnapshot(source: import("../index.js").GltfPhysicsSnapshot): import("../index.js").PhysicsSnapshot;
