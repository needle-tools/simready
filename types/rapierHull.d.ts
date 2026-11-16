/**
 * Native decomposition occasionally returns valid hull vertices with faces that
 * its own convex-mesh cooker rejects. Rebuild only those faces in double
 * precision; keep every hull and its original transform and point set.
 * @param {import('./rapier-types.js').RapierModule} R
 * @param {import('./rapier-types.js').ColliderDescriptor} descriptor
 * @param {string} path
 * @param {import('./description.js').Adaptation[]} adaptations
 */
export function repairConvexCompound(R: import("./rapier-types.js").RapierModule, descriptor: import("./rapier-types.js").ColliderDescriptor, path: string, adaptations: import("./description.js").Adaptation[]): void;
