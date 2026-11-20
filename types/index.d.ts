/** Runtime descriptors retain stage units and explicit body/joint identities. */
/** @param {unknown} snapshot @returns {PhysicsSnapshot} */
export function validateSnapshot(snapshot: unknown): PhysicsSnapshot;
/** Invalid references are distinct from a solver's feature limitations. */
/** @param {PhysicsSnapshot} snapshot */
export function getSnapshotIssues(snapshot: PhysicsSnapshot): PhysicsIssue[];
/** Build the runtime interchange contract.
 * @param {{snapshot:WireSnapshot,stageNode:number,bindings:SimreadyBinding[],semantics?:SimreadySemanticLabels[],mappingIssues?:PhysicsIssue[]}} options
 * @returns {SimreadyRuntimeExtension}
 */
export function createSimreadyRuntimeExtension({ snapshot, stageNode, bindings, semantics, mappingIssues }: {
    snapshot: WireSnapshot;
    stageNode: number;
    bindings: SimreadyBinding[];
    semantics?: SimreadySemanticLabels[];
    mappingIssues?: PhysicsIssue[];
}): SimreadyRuntimeExtension;
/** Validate the runtime interchange descriptor.
 * @param {unknown} value @returns {SimreadyRuntimeExtension}
 */
export function validateSimreadyExtension(value: unknown): SimreadyRuntimeExtension;
export const SIMREADY_EXTENSION: "NEEDLE_simready";
export { createSimreadyRuntimeExtension as createSimreadyExtension };
export type PhysicsVector = [number, number, number];
export type PhysicsRotation = [number, number, number, number];
export type PhysicsIssue = {
    path: string;
    type?: string;
    reason: string;
};
export type PhysicsMass = {
    mass?: number | null;
    density?: number | null;
    centerOfMass?: PhysicsVector;
    diagonalInertia?: PhysicsVector;
    principalAxes?: PhysicsRotation;
};
export type PhysicsBody = PhysicsMass & {
    path: string;
    position: PhysicsVector;
    rotation: PhysicsRotation;
    scale?: PhysicsVector;
    rigidBodyEnabled?: boolean;
    kinematicBody?: boolean;
    startsAsleep?: boolean;
    linearVelocity?: PhysicsVector;
    angularVelocity?: PhysicsVector;
    linearDamping?: number;
    angularDamping?: number;
    gravityScale?: number;
    continuousCollision?: boolean;
    filteredCollisions?: string[];
    simulationOwners?: string[];
};
export type PhysicsShape = PhysicsMass & {
    path: string;
    type: string;
    body?: string;
    position?: PhysicsVector;
    rotation?: PhysicsRotation;
    scale?: PhysicsVector;
    collisionEnabled?: boolean;
    simulationOwners?: string[];
    materials?: string[];
    filteredCollisions?: string[];
    collisionGroups?: string[];
    halfExtents?: PhysicsVector;
    radius?: number;
    halfHeight?: number;
    axis?: "X" | "Y" | "Z";
    approximation?: string;
    meshScale?: PhysicsVector;
    points?: number[] | Float32Array;
    indices?: number[] | Int32Array | Uint16Array | Uint32Array;
};
export type PhysicsLimit = {
    enabled: boolean;
    lower: number | null;
    upper: number | null;
};
export type PhysicsDrive = {
    enabled: boolean;
    targetPosition: number;
    targetVelocity: number;
    stiffness: number;
    damping: number;
    acceleration?: boolean;
    forceLimit?: number | null;
};
export type PhysicsJoint = {
    path: string;
    type: string;
    body0?: string;
    body1?: string;
    position0?: PhysicsVector;
    position1?: PhysicsVector;
    rotation0?: PhysicsRotation;
    rotation1?: PhysicsRotation;
    jointEnabled?: boolean;
    collisionEnabled?: boolean;
    excludeFromArticulation?: boolean;
    axis?: "X" | "Y" | "Z";
    referenceAngle?: number;
    limit?: PhysicsLimit;
    drive?: PhysicsDrive;
    minEnabled?: boolean;
    maxEnabled?: boolean;
    breakForce?: number | null;
    breakTorque?: number | null;
    minDistance?: number;
    maxDistance?: number;
    mimic?: {
        joint: string;
        multiplier: number;
        offset: number;
    };
};
export type PhysicsArticulation = {
    path: string;
    rootPrims: string[];
    filteredCollisions: string[];
    articulatedJoints: string[];
    articulatedBodies: string[];
};
export type PhysicsSnapshot = {
    articulations?: PhysicsArticulation[];
    metersPerUnit?: number;
    kilogramsPerUnit?: number;
    upAxis?: string;
    scenes: {
        path: string;
        gravityDirection?: PhysicsVector;
        gravityMagnitude?: number;
    }[];
    bodies: PhysicsBody[];
    shapes: PhysicsShape[];
    joints: PhysicsJoint[];
    materials: {
        path: string;
        staticFriction?: number;
        dynamicFriction?: number;
        restitution?: number;
        density?: number;
    }[];
    groups: {
        path: string;
        filteredGroups?: string[];
        invertFilteredGroups?: boolean;
        mergedGroups?: string[];
    }[];
    unsupported?: PhysicsIssue[];
};
export type SimreadyBinding = {
    node: number;
    path: string;
    body?: string;
    instance?: unknown;
};
export type WireShape = Omit<PhysicsShape, "points" | "indices"> & {
    mesh?: number;
    points?: never;
    indices?: never;
};
export type GltfPhysicsSnapshot = Omit<PhysicsSnapshot, "metersPerUnit" | "kilogramsPerUnit" | "upAxis">;
export type WireSnapshot = Omit<GltfPhysicsSnapshot, "shapes"> & {
    shapes: WireShape[];
};
/**
 * Semantic labels attach to an exported binding identity, not a USD prim description.
 */
export type SimreadySemanticLabels = {
    path: string;
    taxonomy: string;
    labels: string[];
};
export type SimreadyRuntimeExtension = {
    version: 1;
    stageNode: number;
    snapshot: WireSnapshot;
    bindings: SimreadyBinding[];
    semantics: SimreadySemanticLabels[];
    mappingIssues: PhysicsIssue[];
};
export type SimreadyExtension = SimreadyRuntimeExtension;
