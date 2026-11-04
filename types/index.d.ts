/** Runtime descriptors retain stage units and explicit body/joint identities. */
/** @param {unknown} snapshot @returns {PhysicsSnapshot} */
export function validateSnapshot(snapshot: unknown): PhysicsSnapshot;
/** Invalid references are distinct from a solver's feature limitations. */
/** @param {PhysicsSnapshot} snapshot */
export function getSnapshotIssues(snapshot: PhysicsSnapshot): PhysicsIssue[];
/** Build the versioned glTF contract; geometry stays in ordinary glTF meshes. */
/** @param {{snapshot: WireSnapshot, bindings: SimreadyBinding[], stageNode: number, usdMetadata?: SimreadyMetadata, mappingIssues?: PhysicsIssue[]}} options */
export function createSimreadyExtension({ snapshot, bindings, stageNode, usdMetadata, mappingIssues }: {
    snapshot: WireSnapshot;
    bindings: SimreadyBinding[];
    stageNode: number;
    usdMetadata?: SimreadyMetadata;
    mappingIssues?: PhysicsIssue[];
}): {
    version: 1;
    stageNode: number;
    snapshot: WireSnapshot;
    usdMetadata: SimreadyMetadata;
    bindings: SimreadyBinding[];
    mappingIssues: PhysicsIssue[];
};
export function encodeMetadata(value: unknown): unknown;
export const SIMREADY_EXTENSION: "NEEDLE_simready";
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
export type SimreadyMetadata = {
    version: 1;
    time: number;
    stage: Record<string, unknown>;
    prims: Array<{
        path: string;
        type: string;
        active?: false;
        metadata?: Record<string, unknown>;
        attributes?: Array<{
            name: string;
            type: string;
            value: unknown;
            metadata?: Record<string, unknown>;
            connections?: string[];
            default?: unknown;
            samples?: Array<{
                time: number;
                value: unknown;
            }>;
        }>;
        relationships?: Array<{
            name: string;
            metadata?: Record<string, unknown>;
            targets: string[];
        }>;
        variants?: Array<{
            name: string;
            selection: string;
            choices: string[];
        }>;
    }>;
};
export type WireShape = Omit<PhysicsShape, "points" | "indices"> & {
    mesh?: number;
    points?: never;
    indices?: never;
};
export type WireSnapshot = Omit<PhysicsSnapshot, "shapes"> & {
    shapes: WireShape[];
};
export type SimreadyExtension = {
    version: 1;
    stageNode: number;
    snapshot: WireSnapshot;
    usdMetadata: SimreadyMetadata;
    bindings: SimreadyBinding[];
    mappingIssues: PhysicsIssue[];
};
