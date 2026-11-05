/** Create a world that loads SimReady assets into Needle Engine physics. Each part gets Engine components, so raycasts and collision events work. */
/** @param {NeedleWorldOptions} options @returns {Promise<NeedleSimulationWorld>} */
export function createNeedleSimulationWorld(options: NeedleWorldOptions): Promise<NeedleSimulationWorld>;
export type Context = import("@needle-tools/engine").Context;
export type Rigidbody = import("@needle-tools/engine").Rigidbody;
export type Collider = import("@needle-tools/engine").Collider;
export type NeedleBody = import("./needle/types.js").NeedleBody;
export type EngineCollider = import("./needle/types.js").EngineCollider;
export type EngineJoint = import("./needle/types.js").EngineJoint;
export type EngineAsset = import("./needle/types.js").EngineAsset;
export type EnginePhysics = import("./needle/types.js").EnginePhysics;
export type NeedleBodyRecord = {
    data: import("./index.js").PhysicsBody;
    body: NeedleBody;
    colliders: EngineCollider[];
};
/**
 * Colliders are keyed by their USD path. `collider` is null until Engine has created it.
 */
export type NeedleColliderRecord = {
    data: import("./index.js").PhysicsShape;
    collider: EngineCollider | null;
    owner?: NeedleBodyRecord;
};
export type NeedleAssetOptions = Omit<import("./rapier.js").WorldAssetOptions, "bindVisuals" | "mode"> & {
    mode?: "simulation";
    bindVisuals?: (bodies: ReadonlyMap<string, NeedleBodyRecord>, warn: (item: {
        path: string;
        type?: string;
    }, reason: string) => void, signal: AbortSignal, colliders: ReadonlyMap<string, NeedleColliderRecord>) => import("./rapier.js").VisualBinding | Promise<import("./rapier.js").VisualBinding>;
};
export type NeedleSimulationAsset = Omit<import("./rapier.js").Simulation<never, NeedleBody>, "world" | "bodies" | "colliders" | "joints" | "backend"> & {
    readonly id: string;
    readonly snapshot: import("./index.js").PhysicsSnapshot;
    readonly bodies: ReadonlyMap<string, NeedleBodyRecord>;
    readonly colliders: ReadonlyMap<string, NeedleColliderRecord>;
    readonly joints: ReadonlyMap<string, EngineJoint>;
    readonly physicsAsset: EngineAsset;
    readonly backend: {
        name: string;
        jointSolver: "impulse" | "hybrid";
        adaptations: Array<{
            path: string;
            source: string;
            target: string;
            reason: string;
        }>;
    };
    readonly rigidbodies: ReadonlyMap<string, Rigidbody>;
    readonly colliderComponents: ReadonlyMap<string, Collider>;
};
export type NeedleSimulationWorld = {
    readonly physics: EnginePhysics;
    readonly capabilities: import("./description.js").Capabilities;
    readonly metersPerUnit: number;
    readonly kilogramsPerUnit: number;
    readonly assets: ReadonlyMap<string, NeedleSimulationAsset>;
    addAsset(options: NeedleAssetOptions): Promise<NeedleSimulationAsset>;
    removeAsset(id: string): boolean;
    dispose(): void;
};
export type NeedleWorldOptions = {
    context: Context;
    metersPerUnit?: number;
    kilogramsPerUnit?: number;
};
