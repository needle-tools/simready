// @ts-check
/** @typedef {import('@needle-tools/engine').Context} Context */
/** @typedef {import('@needle-tools/engine').Rigidbody} Rigidbody */
/** @typedef {import('@needle-tools/engine').Collider} Collider */
/** @typedef {NonNullable<import('@needle-tools/engine').RapierPhysics['world']>} World */
/** @typedef {ReturnType<World['createRigidBody']>} RigidBody */
/** @typedef {{readonly rigidbodies:ReadonlyMap<number,Rigidbody>,readonly colliders:ReadonlyMap<number,Collider>,dispose():void}} ExternalRegistration */
/** The bridge checks these capabilities because released Engine versions may
 * predate external registration, despite exposing the same Rapier world.
 * @typedef {{world:World|undefined,initialize():void|Promise<void>,
 * registerWorldExtension(extension:import('../rapier.js').SimulationWorldExtension):()=>void,
 * registerExternalPhysics(options:{root:import('three').Object3D,syncTransforms:boolean,
 * bodies:{body:import('../rapier-types.js').RigidBody,object?:import('three').Object3D}[],
 * colliders:{collider:import('../rapier-types.js').Collider,object?:import('three').Object3D}[],
 * onDestroy():void}):ExternalRegistration}} EnginePhysics
 */
import {isRecord} from '../validation.js';
/** @param {unknown} value @returns {value is EnginePhysics} */
export function supportsExternalPhysics(value){
 return isRecord(value)&&typeof value.initialize==='function'
  &&typeof value.registerExternalPhysics==='function'&&typeof value.registerWorldExtension==='function';
}
