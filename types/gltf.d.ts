/** @template {SimreadyLoader} L @param {L} loader @returns {L} */
export function registerSimreadyLoader<L extends SimreadyLoader>(loader: L): L;
/** Find an activated glTF runtime inside a host's loaded scene. */
/** @param {unknown} asset @returns {SimreadyRuntime|null} */
export function getSimreadyRuntime(asset: unknown): SimreadyRuntime | null;
export { SIMREADY_EXTENSION } from "./index.js";
/** Attach lazy simulation/interaction factories; loading never starts simulation. */
export class NeedleSimreadyLoaderPlugin {
    /** @param {SimreadyParser} parser */
    constructor(parser: SimreadyParser);
    parser: SimreadyParser;
    name: string;
    /** @param {SimreadyLoadResult} result */
    afterRoot(result: SimreadyLoadResult): Promise<void>;
}
export type Object3D = import("three").Object3D;
export type PhysicsSnapshot = import("./index.js").PhysicsSnapshot;
export type SimreadyMetadata = import("./index.js").SimreadyMetadata;
export type PhysicsIssue = import("./index.js").PhysicsIssue;
export type Mechanism = import("./kinematics.js").Mechanism;
export type RigidBody = import("./rapier-types.js").RigidBody;
export type World = import("./rapier-types.js").World;
export type ObjectBinding = import("./three.js").ObjectBinding;
export type SimreadyRuntime = {
    readonly snapshot: import("./index.js").GltfPhysicsSnapshot;
    readonly usdMetadata: SimreadyMetadata;
    readonly root: Object3D;
    readonly bindings: ObjectBinding[];
    readonly mappingIssues: PhysicsIssue[];
    createMechanism(options?: Omit<import("./kinematics.js").MechanismOptions, "snapshot" | "bindVisuals">): Promise<Mechanism & {
        root: Object3D;
    }>;
    createSimulation: CreateBoundSimulation;
};
export type CreateBoundSimulation = <B extends RigidBody, W extends import("./rapier-types.js").World<B>>(options: (Omit<import("./rapier.js").SimulationOptions<B, W>, "snapshot"> & {
    world?: never;
}) | ({
    world: import("./rapier.js").SimulationWorld<W, B>;
} & Omit<import("./rapier.js").WorldAssetOptions<B>, "snapshot">)) => Promise<import("./rapier.js").Simulation<W, B> & {
    root: Object3D;
}>;
export type SimreadyParser = {
    json: {
        extensions?: Record<string, unknown>;
        nodes?: unknown[];
        meshes?: {
            primitives: {
                mode?: number;
            }[];
        }[];
    };
    getDependency(type: string, index: number): Promise<unknown>;
};
export type SimreadyLoadResult = {
    scene: Object3D;
    userData?: Record<string, unknown>;
};
export type SimreadyLoader = {
    register(factory: (parser: SimreadyParser) => NeedleSimreadyLoaderPlugin): unknown;
};
export type CollisionPrimitive = import("three").Mesh | import("three").Line | import("three").Points;
export { toGltfPhysicsSnapshot, fromGltfPhysicsSnapshot } from "./gltf/coordinates.js";
