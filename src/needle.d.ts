import type {Context, Rigidbody, Collider} from '@needle-tools/engine';
import type {World, RigidBody} from '@dimforge/rapier3d-compat';
import type {SimulationWorld, SimulationAsset, WorldAssetOptions} from './rapier.js';
export interface NeedleSimulationAsset extends SimulationAsset<World,RigidBody> {
 readonly rigidbodies:ReadonlyMap<string,Rigidbody>;
 readonly colliderComponents:ReadonlyMap<number,Collider>;
}
export interface NeedleSimulationWorld extends SimulationWorld<World,RigidBody> {
 readonly assets:ReadonlyMap<string,NeedleSimulationAsset>;
 addAsset(options:WorldAssetOptions):Promise<NeedleSimulationAsset>;
}
/** Engine owns stepping. SimReady owns imported resources and unregisters them before Engine frees its world. */
export function createNeedleSimulationWorld(options:{context:Context;metersPerUnit?:number;kilogramsPerUnit?:number}):Promise<NeedleSimulationWorld>;
