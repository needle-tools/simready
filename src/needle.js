// @ts-check

/** @typedef {import('@needle-tools/engine').Context} Context */
/** @typedef {import('@needle-tools/engine').Rigidbody} Rigidbody */
/** @typedef {import('@needle-tools/engine').Collider} Collider */
/** @typedef {import('./needle/types.js').NeedleBody} NeedleBody */
/** @typedef {import('./needle/types.js').EngineCollider} EngineCollider */
/** @typedef {import('./needle/types.js').EngineJoint} EngineJoint */
/** @typedef {import('./needle/types.js').EngineAsset} EngineAsset */
/** @typedef {import('./needle/types.js').EnginePhysics} EnginePhysics */
/** @typedef {{data:import('./index.js').PhysicsBody,body:NeedleBody,colliders:EngineCollider[]}} NeedleBodyRecord */
/** Colliders are keyed by their USD path. `collider` is null until Engine has created it.
 * @typedef {{data:import('./index.js').PhysicsShape,collider:EngineCollider|null,owner?:NeedleBodyRecord}} NeedleColliderRecord */
/** @typedef {Omit<import('./rapier.js').WorldAssetOptions,'bindVisuals'|'mode'> & {mode?:'simulation',
 * bindVisuals?:(bodies:ReadonlyMap<string,NeedleBodyRecord>,warn:(item:{path:string,type?:string},reason:string)=>void,signal:AbortSignal,
 * colliders:ReadonlyMap<string,NeedleColliderRecord>)=>import('./rapier.js').VisualBinding|Promise<import('./rapier.js').VisualBinding>}} NeedleAssetOptions */
/** @typedef {Omit<import('./rapier.js').Simulation<never,NeedleBody>,'world'|'bodies'|'colliders'|'joints'|'backend'> & {
 * readonly id:string,readonly snapshot:import('./index.js').PhysicsSnapshot,
 * readonly bodies:ReadonlyMap<string,NeedleBodyRecord>,readonly colliders:ReadonlyMap<string,NeedleColliderRecord>,
 * readonly joints:ReadonlyMap<string,EngineJoint>,readonly physicsAsset:EngineAsset,
 * readonly backend:{name:string,jointSolver:'impulse'|'hybrid',adaptations:Array<{path:string,source:string,target:string,reason:string}>},
 * readonly rigidbodies:ReadonlyMap<string,Rigidbody>,readonly colliderComponents:ReadonlyMap<string,Collider>}} NeedleSimulationAsset */
/** @typedef {{readonly physics:EnginePhysics,readonly capabilities:import('./description.js').Capabilities,
 * readonly metersPerUnit:number,readonly kilogramsPerUnit:number,
 * readonly assets:ReadonlyMap<string,NeedleSimulationAsset>,
 * addAsset(options:NeedleAssetOptions):Promise<NeedleSimulationAsset>,removeAsset(id:string):boolean,dispose():void}} NeedleSimulationWorld */
/** @typedef {{context:Context,metersPerUnit?:number,kilogramsPerUnit?:number}} NeedleWorldOptions */

import {createNeedleWorld} from './needle/world.js';

/** Create a world that loads SimReady assets into Needle Engine physics. Each part gets Engine components, so raycasts and collision events work. */
/** @param {NeedleWorldOptions} options @returns {Promise<NeedleSimulationWorld>} */
export async function createNeedleSimulationWorld(options) {
    // Engine versions declare different Physics members. createNeedleWorld checks the ones it needs at runtime.
    return createNeedleWorld(/** @type {Parameters<typeof createNeedleWorld>[0]} */ (/** @type {unknown} */ (options)));
}
