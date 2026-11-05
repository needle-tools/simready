// @ts-check
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 * @typedef {{x:number,y:number,z:number}} Vector
 * @typedef {Vector & {w:number}} Rotation
 * @typedef {{readonly id:string,readonly component:object,readonly isValid:boolean,type:'dynamic'|'kinematic'|'fixed',
 * readonly isSleeping:boolean,readonly mass:number,
 * getPosition():Vector,getRotation():Rotation,setPose(pose:{position?:Vector,rotation?:Rotation},wake?:boolean):void,
 * setKinematicTarget(pose:{position?:Vector,rotation?:Rotation}):void,
 * getLinearVelocity():Vector,setLinearVelocity(value:Vector,wake?:boolean):void,
 * getAngularVelocity():Vector,setAngularVelocity(value:Vector,wake?:boolean):void,
 * resetForces(wake?:boolean):void,sleep():void,wakeUp():void}} EngineBody
 * @typedef {{readonly id:string,readonly body:EngineBody|null,readonly component:object,readonly isValid:boolean}} EngineCollider
 * @typedef {{readonly id:string,readonly isValid:boolean,setDriveTarget(target:{position?:number,velocity?:number}):boolean}} EngineJoint
 * @typedef {{readonly bodies:ReadonlyMap<string,EngineBody>,readonly colliders:ReadonlyMap<string,EngineCollider>,
 * readonly joints:ReadonlyMap<string,EngineJoint>,
 * readonly issues:ReadonlyArray<{id:string,kind:string,reason:string}>,
 * readonly adaptations:ReadonlyArray<{id:string,source:string,target:string,reason:string}>,
 * readonly isDisposed:boolean,hold():void,release():void,dispose():void}} EngineAsset
 * @typedef {{root?:import('three').Object3D,syncTransforms?:boolean,allowPartial?:boolean,
 * bodies?:Array<import('../description.js').BodyDescription|{id:string,type:'kinematic',position:Vector}>,
 * colliders?:import('../description.js').ColliderDescription[],
 * joints?:Array<import('../description.js').JointDescription|{id:string,type:'spring',body0:object,body1:string,anchor0:Vector,spring:{stiffness:number,damping:number}}>,
 * articulations?:import('../description.js').ArticulationDescription[],
 * shouldCollide?(a:EngineCollider,b:EngineCollider):boolean,onAfterStep?():void,onDestroy?():void}} EngineAssetDescription
 * @typedef {{initialize():unknown,readonly capabilities?:import('../description.js').Capabilities,
 * createAsset(description:EngineAssetDescription):EngineAsset,onWorldDisposed(callback:()=>void):()=>void}} EnginePhysics
 * @typedef {import('../simulationRuntime.js').RuntimeBody & {
 * readonly handle:EngineBody|undefined,attach(handle:EngineBody):void,isValid():boolean,
 * linvel():Vector,angvel():Vector,isSleeping():boolean,wakeUp():void}} NeedleBody
 */
import {isRecord} from '../validation.js';
/** @param {unknown} value @returns {value is EnginePhysics} */
export function supportsPhysicsAssets(value){
 return isRecord(value)&&typeof value.initialize==='function'
  &&typeof value.createAsset==='function'&&typeof value.onWorldDisposed==='function';
}
