/** Share Needle's Rapier world and register imported physics as Engine components. */
/** @param {NeedleWorldOptions} options @returns {Promise<NeedleSimulationWorld>} */
export function createNeedleSimulationWorld({ context, ...options }: NeedleWorldOptions): Promise<NeedleSimulationWorld>;
export type Context = import("@needle-tools/engine").Context;
export type Rigidbody = import("@needle-tools/engine").Rigidbody;
export type Collider = import("@needle-tools/engine").Collider;
export type RapierPhysics = import("@needle-tools/engine").RapierPhysics;
export type World = NonNullable<RapierPhysics["world"]>;
export type RigidBody = ReturnType<World["createRigidBody"]>;
export type NeedleSimulationAsset = import("./rapier.js").SimulationAsset<World, RigidBody> & {
    readonly rigidbodies: ReadonlyMap<string, Rigidbody>;
    readonly colliderComponents: ReadonlyMap<number, Collider>;
};
export type NeedleSimulationWorld = Omit<import("./rapier.js").SimulationWorld<World, RigidBody>, "assets" | "addAsset"> & {
    readonly assets: ReadonlyMap<string, NeedleSimulationAsset>;
    addAsset(options: import("./rapier.js").WorldAssetOptions<RigidBody>): Promise<NeedleSimulationAsset>;
};
export type NeedleWorldOptions = {
    context: Context;
    metersPerUnit?: number;
    kilogramsPerUnit?: number;
};
