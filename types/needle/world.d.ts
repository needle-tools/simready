/** Internal dependency boundary keeps standalone imports independent of Engine. */
/** @param {{NEEDLE_ENGINE_MODULES:{RAPIER_PHYSICS:{MODULE:import('../rapier.js').RapierModule<RigidBody,World>}}}} engine
 * @param {{context:{scene:Object3D,physics:{getOrCreatePhysicsEngine():unknown}},metersPerUnit?:number,kilogramsPerUnit?:number}} options
 * @returns {Promise<import('../needle.js').NeedleSimulationWorld>} */
export function createNeedleWorld(engine: {
    NEEDLE_ENGINE_MODULES: {
        RAPIER_PHYSICS: {
            MODULE: import("../rapier.js").RapierModule<RigidBody, World>;
        };
    };
}, { context, metersPerUnit, kilogramsPerUnit }: {
    context: {
        scene: Object3D;
        physics: {
            getOrCreatePhysicsEngine(): unknown;
        };
    };
    metersPerUnit?: number;
    kilogramsPerUnit?: number;
}): Promise<import("../needle.js").NeedleSimulationWorld>;
export type Object3D = import("three").Object3D;
export type World = import("./types.js").World;
export type RigidBody = import("./types.js").RigidBody;
export type Rigidbody = import("./types.js").Rigidbody;
export type NeedleSimulationAsset = import("../needle.js").NeedleSimulationAsset;
