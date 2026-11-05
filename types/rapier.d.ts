/** Descriptors the Rapier adapter cannot simulate, known before loading its runtime. */
/** @param {PhysicsSnapshot} snapshot */
export function getSimulationLimitations(snapshot: PhysicsSnapshot): import("./index.js").PhysicsIssue[];
/**
 * Create a simulation in stage coordinates. Supply an initialized Rapier module;
 * importing the USD renderer alone does not download another WASM runtime.
 */
/** @template {RigidBody} B
 * @template {World<B>} W
 * @param {SimulationOptions<B,W> & {worldContext?:WorldContext<W>}} options
 * @returns {Promise<Simulation<W,B>>}
 */
export function createSimulation<B extends RigidBody, W extends World<B>>({ rapier: R, snapshot, scenePath, mode, allowPartial, bindVisuals, worldContext }: SimulationOptions<B, W> & {
    worldContext?: WorldContext<W>;
}): Promise<Simulation<W, B>>;
/** One host-owned contact world for independently loaded asset instances. */
/** @template {RigidBody} B
 * @template {World<B>} W
 * @param {{rapier:RapierModule<B,W>,world?:W,registerWorldExtension?:(extension:SimulationWorldExtension)=>()=>void,gravity?:PhysicsVector,timestep?:number,metersPerUnit?:number,kilogramsPerUnit?:number}} options
 * @returns {SimulationWorld<W,B>}
 */
export function createSimulationWorld<B extends RigidBody, W extends World<B>>({ rapier: R, world: borrowedWorld, registerWorldExtension, gravity, timestep, metersPerUnit, kilogramsPerUnit }: {
    rapier: RapierModule<B, W>;
    world?: W;
    registerWorldExtension?: (extension: SimulationWorldExtension) => () => void;
    gravity?: PhysicsVector;
    timestep?: number;
    metersPerUnit?: number;
    kilogramsPerUnit?: number;
}): SimulationWorld<W, B>;
export { shiftInertiaToCenterOfMass } from "./massProperties.js";
export type PhysicsSnapshot = import("./index.js").PhysicsSnapshot;
export type PhysicsBody = import("./index.js").PhysicsBody;
export type PhysicsShape = import("./index.js").PhysicsShape;
export type PhysicsJoint = import("./index.js").PhysicsJoint;
export type PhysicsDrive = import("./index.js").PhysicsDrive;
export type PhysicsIssue = import("./index.js").PhysicsIssue;
export type PhysicsVector = import("./index.js").PhysicsVector;
export type PhysicsRotation = import("./index.js").PhysicsRotation;
export type RigidBody = import("./rapier-types.js").RigidBody;
export type Collider = import("./rapier-types.js").Collider;
export type Joint = import("./rapier-types.js").Joint;
export type RigidBodyDescriptor = import("./rapier-types.js").RigidBodyDescriptor;
export type JointDescriptor = import("./rapier-types.js").JointDescriptor;
export type World<B extends RigidBody = import("./rapier-types.js").RigidBody> = import("./rapier-types.js").World<B>;
export type RapierModule<B extends RigidBody = import("./rapier-types.js").RigidBody, W extends World<B> = World<B>> = import("./rapier-types.js").RapierModule<B, W>;
export type WorldOf<R extends RapierModule> = InstanceType<R["World"]>;
export type BodyOf<R extends RapierModule> = ReturnType<WorldOf<R>["createRigidBody"]>;
export type VisualBinding = {
    sync(): void;
    reset(): void;
    dispose?(): void;
    bodyForObject(object: unknown, instanceIndex?: number): unknown;
    root?: import("three").Object3D;
    bindings?: import("./three.js").ObjectBinding[];
};
export type SimulationBodyRecord<B = import("./rapier-types.js").RigidBody> = {
    data: PhysicsBody;
    body: B;
    colliders: Collider[];
};
export type SimulationBodies<B = import("./rapier-types.js").RigidBody> = Map<string, SimulationBodyRecord<B>>;
export type SimulationColliderRecord<B = import("./rapier-types.js").RigidBody> = {
    data: PhysicsShape;
    collider: Collider;
    owner?: SimulationBodyRecord<B>;
};
export type SimulationColliders<B = import("./rapier-types.js").RigidBody> = Map<number, SimulationColliderRecord<B>>;
export type Simulation<W = World<import("./rapier-types.js").RigidBody>, B = import("./rapier-types.js").RigidBody> = {
    readonly backend: {
        name: "rapier";
        jointSolver: "impulse" | "hybrid";
        adaptations: Array<{
            path: string;
            source: string;
            target: string;
            reason: string;
        }>;
    };
    readonly world: W;
    readonly bodies: SimulationBodies<B>;
    readonly colliders: SimulationColliders<B>;
    readonly joints: Map<string, Joint>;
    readonly unsupported: PhysicsIssue[];
    play(): void;
    pause(): void;
    isPlaying(): boolean;
    update(dt: number): void;
    step(dt?: number): void;
    getJointValue(path: string): number | null;
    setJointTarget(path: string, target: {
        position?: number;
        velocity?: number;
    }): boolean;
    reset(): void;
    dispose(): void;
    bodyForObject(object: unknown, instanceIndex?: number): unknown;
    beginDrag(path: string, position: import("./rapier-types.js").Vector): boolean;
    moveDrag(position: import("./rapier-types.js").Vector): void;
    endDrag(): void;
};
export type SimulationOptions<B extends RigidBody = import("./rapier-types.js").RigidBody, W extends World<B> = World<B>> = {
    snapshot: PhysicsSnapshot;
    rapier: RapierModule<B, W>;
    scenePath?: string;
    allowPartial?: boolean;
    mode?: "simulation" | "interaction";
    bindVisuals?: (bodies: SimulationBodies<B>, warn: (item: {
        path: string;
        type?: string;
    }, reason: string) => void, signal: AbortSignal, colliders: SimulationColliders<B>) => VisualBinding | Promise<VisualBinding>;
};
export type WorldAssetOptions<B extends RigidBody = import("./rapier-types.js").RigidBody> = Omit<SimulationOptions<B>, "rapier"> & {
    id?: string;
    position?: PhysicsVector;
    rotation?: PhysicsRotation;
};
export type SimulationAsset<W = World<import("./rapier-types.js").RigidBody>, B = import("./rapier-types.js").RigidBody> = Simulation<W, B> & {
    readonly id: string;
    readonly snapshot: PhysicsSnapshot;
};
export type SimulationHooks = import("./rapier-types.js").PhysicsHooks;
/**
 * Options for adding an asset to a shared world.
 */
export type HostAssetOptions = {
    snapshot: PhysicsSnapshot;
    id?: string;
    position?: PhysicsVector;
    rotation?: PhysicsRotation;
    scenePath?: string;
    allowPartial?: boolean;
    mode?: "simulation";
    bindVisuals?: (bodies: ReadonlyMap<string, {
        data: PhysicsBody;
        body: import("./kinematics.js").BodyPose;
    }>, warn: (item: {
        path: string;
        type?: string;
    }, reason: string) => void, signal: AbortSignal) => VisualBinding | Promise<VisualBinding>;
};
/**
 * A world that several assets share: a SimReady world or a Needle Engine world.
 */
export type SimulationHost<A> = {
    readonly metersPerUnit: number;
    addAsset(options: HostAssetOptions): Promise<A>;
};
export type SimulationWorldExtension = {
    hooks: SimulationHooks;
    afterStep(): void;
    dispose(): void;
};
export type SimulationWorld<W = World<import("./rapier-types.js").RigidBody>, B extends RigidBody = import("./rapier-types.js").RigidBody> = {
    readonly ownsWorld: boolean;
    readonly hooks: SimulationHooks;
    sync(): void;
    readonly metersPerUnit: number;
    readonly kilogramsPerUnit: number;
    readonly world: W;
    readonly assets: ReadonlyMap<string, SimulationAsset<W, B>>;
    addAsset(options: WorldAssetOptions<B>): Promise<SimulationAsset<W, B>>;
    removeAsset(id: string): boolean;
    step(dt?: number): void;
    dispose(): void;
};
export type WorldContext<W> = {
    world: W;
    events: import("./rapier-types.js").EventQueue | undefined;
    isDisposed(): boolean;
    trackResources(cleanup: () => void): () => void;
    register(entry: {
        hooks: SimulationHooks;
        sync(): void;
    }): () => void;
};
