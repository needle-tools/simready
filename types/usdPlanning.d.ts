/** Plan native PhysX mimic articulations without modifying source records.
 * A shared fixed identity base replaces world endpoints only for grounded
 * components required by a coupling. Floating components must already connect.
 * Mandatory mimic/reference edges are retained; other cycle edges become
 * ordinary maximal-coordinate closure constraints. Existing articulation
 * membership and kinematic/disabled links require an explicit caller adaptation.
 * The result describes a schema export, not Foundation profile certification.
 * @param {import('./index.js').PhysicsSnapshot} source
 * @returns {UsdPhysicsSnapshot}
 */
export function prepareUsdPhysicsSnapshot(source: import("./index.js").PhysicsSnapshot): UsdPhysicsSnapshot;
export type UsdPhysicsJoint = import("./index.js").PhysicsJoint & {
    articulationRoot?: boolean;
};
export type UsdPhysicsBody = import("./index.js").PhysicsBody & {
    usdSyntheticBase?: boolean;
    articulationRoot?: boolean;
};
export type UsdPhysicsSnapshot = Omit<import("./index.js").PhysicsSnapshot, "bodies" | "joints"> & {
    bodies: UsdPhysicsBody[];
    joints: UsdPhysicsJoint[];
};
