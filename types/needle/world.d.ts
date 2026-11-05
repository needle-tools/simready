/** Create a world that turns SimReady snapshots into Engine physics assets. */
/** @param {{context:{scene:Object3D,physics:{getOrCreatePhysicsEngine():unknown}},metersPerUnit?:number,kilogramsPerUnit?:number}} options
 * @returns {Promise<NeedleSimulationWorld>} */
export function createNeedleWorld({ context, metersPerUnit, kilogramsPerUnit }: {
    context: {
        scene: Object3D;
        physics: {
            getOrCreatePhysicsEngine(): unknown;
        };
    };
    metersPerUnit?: number;
    kilogramsPerUnit?: number;
}): Promise<NeedleSimulationWorld>;
export type Object3D = import("three").Object3D;
export type EnginePhysics = import("./types.js").EnginePhysics;
export type EngineAsset = import("./types.js").EngineAsset;
export type EngineBody = import("./types.js").EngineBody;
export type NeedleBody = import("./types.js").NeedleBody;
export type BodyDescription = import("../description.js").BodyDescription;
export type NeedleSimulationAsset = import("../needle.js").NeedleSimulationAsset;
export type NeedleSimulationWorld = import("../needle.js").NeedleSimulationWorld;
export type NeedleAssetOptions = import("../needle.js").NeedleAssetOptions;
export type NeedleBodyRecord = import("../needle.js").NeedleBodyRecord;
export type NeedleColliderRecord = import("../needle.js").NeedleColliderRecord;
