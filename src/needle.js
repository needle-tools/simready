// @ts-check

/** @typedef {import('@needle-tools/engine').Context} Context */
/** @typedef {import('@needle-tools/engine').Rigidbody} Rigidbody */
/** @typedef {import('@needle-tools/engine').Collider} Collider */
/** @typedef {import('@needle-tools/engine').RapierPhysics} RapierPhysics */
/** @typedef {NonNullable<RapierPhysics['world']>} World */
/** @typedef {ReturnType<World['createRigidBody']>} RigidBody */
/** @typedef {import('./rapier.js').SimulationAsset<World,RigidBody> & {
 * readonly rigidbodies:ReadonlyMap<string,Rigidbody>,readonly colliderComponents:ReadonlyMap<number,Collider>}} NeedleSimulationAsset */
/** @typedef {Omit<import('./rapier.js').SimulationWorld<World,RigidBody>,'assets'|'addAsset'> & {
 * readonly assets:ReadonlyMap<string,NeedleSimulationAsset>,
 * addAsset(options:import('./rapier.js').WorldAssetOptions<RigidBody>):Promise<NeedleSimulationAsset>}} NeedleSimulationWorld */
/** @typedef {{context:Context,metersPerUnit?:number,kilogramsPerUnit?:number}} NeedleWorldOptions */

import {createNeedleWorld} from './needle/world.js';

/** Share Needle's Rapier world and register imported physics as Engine components. */
/** @param {NeedleWorldOptions} options @returns {Promise<NeedleSimulationWorld>} */
export async function createNeedleSimulationWorld({context, ...options}) {
    const engine = await import('@needle-tools/engine');
    return createNeedleWorld(engine, {context, ...options});
}
