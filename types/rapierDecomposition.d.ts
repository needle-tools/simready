/**
 * Cook in a centered unit box so VHACD's floating-point predicates do not depend
 * on the asset's local origin or units. Restore every hull to the collider frame
 * before mass properties and contacts are constructed.
 * @param {import('./rapier-types.js').RapierModule} R
 * @param {Extract<import('./description.js').ShapeDescription,{type:'convexDecomposition'}>} shape
 * @param {string} path
 */
export function cookConvexDecomposition(R: import("./rapier-types.js").RapierModule, shape: Extract<import("./description.js").ShapeDescription, {
    type: "convexDecomposition";
}>, path: string): import("./rapier-types.js").ColliderDescriptor | null;
