// @ts-check

/** Minimum IK interface used by the mechanism adapter. The upstream declarations
 * use boxed numeric types and omit methods present in the pinned implementation.
 * @typedef {{name:string,matrixWorld:Float32Array,
 * setPosition(x:number,y:number,z:number):void,
 * setQuaternion(x:number,y:number,z:number,w:number):void,
 * updateMatrixWorld(force?:boolean):void}} Frame
 * @typedef {Frame & {addChild(child:Joint):void}} Link
 * @typedef {Frame & {addChild(child:Link):void,makeClosure(child:Link):void,
 * setDoF(dof:number):void,setDoFValue(dof:number,value:number):boolean,
 * getDoFValue(dof:number):number,setMinLimit(dof:number,value:number):void,
 * setMaxLimit(dof:number,value:number):void,minDoFLimit:Float32Array,maxDoFLimit:Float32Array,
 * getClosureError(position:Float64Array,rotation:Float64Array):void}} Joint
 * @typedef {{maxIterations:number,translationConvergeThreshold:number,
 * rotationConvergeThreshold:number,useSVD:boolean,solve():void}} Solver
 * @typedef {{Link:new()=>Link,Joint:new()=>Joint,Solver:new(root:Link)=>Solver,
 * DOF:{X:number,Y:number,Z:number,EX:number,EY:number,EZ:number}}} KinematicsModule
 */
import {isRecord} from './validation.js';

/** @param {unknown} value @param {string[]} methods */
function constructorWith(value,methods){
 if(typeof value!=='function')return false;
 /** @type {unknown} */
 const prototype=value.prototype;
 return isRecord(prototype)&&methods.every(name=>typeof prototype[name]==='function');
}
/** @param {unknown} value @returns {value is KinematicsModule} */
function isKinematicsModule(value){
 if(!isRecord(value)||!isRecord(value.DOF))return false;
 const dof=value.DOF;
 return ['X','Y','Z','EX','EY','EZ'].every(key=>typeof dof[key]==='number')
  &&constructorWith(value.Link,['setPosition','setQuaternion','updateMatrixWorld','addChild'])
  &&constructorWith(value.Joint,['setPosition','setQuaternion','setDoF','setDoFValue','getDoFValue','setMinLimit','setMaxLimit','getClosureError','makeClosure','addChild'])
  &&constructorWith(value.Solver,['solve']);
}
/** Check the optional injected module at its loading boundary.
 * @param {()=>Promise<unknown>} [load] @returns {Promise<KinematicsModule>}
 */
export async function loadKinematicsModule(load){
 /** @type {unknown} */
 const value=await (load?load():import('closed-chain-ik/core'));
 if(!isKinematicsModule(value))throw new TypeError('Invalid kinematics module.');
 return value;
}
