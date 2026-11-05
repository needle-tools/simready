/** What SimReady's own Rapier builder supports, depending on the Rapier version passed in. */
/** @param {{ColliderDesc?:{halfspace?:unknown,convexDecomposition?:unknown},CompoundFlags?:unknown}} [R] @returns {Capabilities} */
export function rapierCapabilities(R?: {
    ColliderDesc?: {
        halfspace?: unknown;
        convexDecomposition?: unknown;
    };
    CompoundFlags?: unknown;
}): Capabilities;
/**
 * Convert a snapshot into the body, collider and joint descriptions that buildRapierAsset and
 * Needle Engine's physics.createAsset build.
 * Lengths and masses stay in the snapshot's units; angles become radians.
 * Anything the backend can't handle is left out and listed in `issues`.
 */
/** @param {PhysicsSnapshot} snapshot
 * @param {{scenePath?:string,mode?:'simulation'|'interaction',capabilities:Capabilities}} options
 * @returns {SimulationDescription}
 */
export function describeSimulation(snapshot: PhysicsSnapshot, { scenePath, mode, capabilities }: {
    scenePath?: string;
    mode?: "simulation" | "interaction";
    capabilities: Capabilities;
}): SimulationDescription;
export type PhysicsSnapshot = import("./index.js").PhysicsSnapshot;
export type PhysicsBody = import("./index.js").PhysicsBody;
export type PhysicsShape = import("./index.js").PhysicsShape;
export type PhysicsJoint = import("./index.js").PhysicsJoint;
export type PhysicsIssue = import("./index.js").PhysicsIssue;
export type Vector = {
    x: number;
    y: number;
    z: number;
};
export type Rotation = Vector & {
    w: number;
};
export type MassDescription = {
    mass?: number;
    centerOfMass?: Vector;
    inertia?: Vector;
    inertiaRotation?: Rotation;
};
/**
 * Collider shapes. Capsules, cylinders and cones point along local +Y.
 */
export type ShapeDescription = {
    type: "box";
    halfExtents: Vector;
} | {
    type: "sphere";
    radius: number;
} | {
    type: "capsule" | "cylinder" | "cone";
    radius: number;
    halfHeight: number;
} | {
    type: "plane";
    normal?: Vector;
} | {
    type: "convexHull";
    points: Float32Array;
} | {
    type: "triangleMesh";
    points: Float32Array;
    indices: Uint32Array;
} | {
    type: "convexDecomposition";
    points: Float32Array;
    indices: Uint32Array;
    maxHulls?: number;
    resolution?: number;
    concavity?: number;
};
export type BodyDescription = {
    id: string;
    type: "dynamic" | "kinematic" | "fixed";
    position: Vector;
    rotation: Rotation;
    linearVelocity: Vector;
    angularVelocity: Vector;
    sleeping: boolean;
    continuousCollision: boolean;
    mass?: MassDescription;
};
export type ColliderDescription = {
    id: string;
    body?: string;
    shape: ShapeDescription;
    position: Vector;
    rotation: Rotation;
    friction: number;
    restitution: number;
    density: number;
    mass?: MassDescription;
};
export type DriveDescription = {
    model: "force" | "acceleration";
    stiffness: number;
    damping: number;
    maxForce?: number;
    targetPosition: number;
    targetVelocity: number;
};
export type JointDescription = {
    id: string;
    type: "fixed" | "revolute" | "prismatic" | "spherical" | "distance" | "spring";
    body0?: string;
    body1?: string;
    anchor0: Vector;
    rotation0: Rotation;
    anchor1: Vector;
    rotation1: Rotation;
    axis: Vector;
    limits?: {
        lower: number;
        upper: number;
    };
    drive?: DriveDescription;
    maxDistance?: number;
    spring?: {
        stiffness: number;
        damping: number;
        restLength?: number;
    };
    coneLimit?: number;
    breakForce?: number;
    breakTorque?: number;
    collisionEnabled: boolean;
    articulation?: string;
};
export type ArticulationDescription = {
    id: string;
    bodies: string[];
    solverIterations: number;
};
/**
 * What the target physics backend supports.
 */
export type Capabilities = {
    backend: string;
    shapes: ReadonlySet<string>;
    joints: ReadonlySet<string>;
    features: ReadonlySet<string>;
};
export type Adaptation = {
    path: string;
    source: string;
    target: string;
    reason: string;
};
export type ColliderData = {
    data: PhysicsShape;
    owner?: PhysicsBody;
};
export type SimulationDescription = {
    scene: PhysicsSnapshot["scenes"][number] | undefined;
    metersPerUnit: number;
    kilogramsPerUnit: number;
    bodies: BodyDescription[];
    colliders: ColliderDescription[];
    joints: JointDescription[];
    articulations: ArticulationDescription[];
    bodyData: Map<string, PhysicsBody>;
    colliderData: Map<string, ColliderData>;
    jointData: Map<string, PhysicsJoint>;
    issues: PhysicsIssue[];
    adaptations: Adaptation[];
    shouldCollide(a: string, b: string): boolean;
};
