import type {BodyPose} from './kinematics.js';
export type RapierModule={World:new(...args:never[])=>object};
export type WorldOf<R extends RapierModule>=InstanceType<R['World']>;
export type BodyOf<R extends RapierModule>=WorldOf<R> extends {createRigidBody(desc:never):infer B}?B:BodyPose;
import type {PhysicsSnapshot,PhysicsBody,PhysicsShape,PhysicsIssue,PhysicsVector,PhysicsRotation} from './index.js';
export interface VisualBinding {sync():void;reset():void;dispose?():void;bodyForObject(object:unknown,instanceIndex?:number):unknown;root?:import('three').Object3D;bindings?:import('./three.js').ObjectBinding[]}
export type SimulationBodyRecord<B=BodyPose>={data:PhysicsBody;body:B;colliders:object[]};
export type SimulationBodies<B=BodyPose>=Map<string,SimulationBodyRecord<B>>;
export type SimulationColliders<B=BodyPose>=Map<number,{data:PhysicsShape;collider:object;owner?:SimulationBodyRecord<B>}>;
export interface Simulation<W=object,B=BodyPose> {
 readonly backend:{name:'rapier';jointSolver:'impulse'|'hybrid';adaptations:Array<{path:string;source:string;target:string;reason:string}>};
 readonly world:W;readonly bodies:SimulationBodies<B>;readonly colliders:SimulationColliders<B>;readonly joints:Map<string,object>;readonly unsupported:PhysicsIssue[];
 play():void;pause():void;isPlaying():boolean;update(dt:number):void;
 /** Advance exactly dt; independent of playback. Shared assets are stepped by their world. */
 step(dt?:number):void;
 getJointValue(path:string):number|null;setJointTarget(path:string,target:{position?:number;velocity?:number}):boolean;
 reset():void;dispose():void;
 bodyForObject(object:unknown,instanceIndex?:number):unknown;
 beginDrag(path:string,position:{x:number;y:number;z:number}):boolean;
 moveDrag(position:{x:number;y:number;z:number}):void;endDrag():void;
}
export interface SimulationOptions {
 snapshot:PhysicsSnapshot;rapier:RapierModule;scenePath?:string;allowPartial?:boolean;mode?:'simulation'|'interaction';
 /** Async bindings must check signal after each await before accessing bodies. */
 bindVisuals?:(bodies:SimulationBodies,warn:(item:{path:string;type?:string},reason:string)=>void,signal:AbortSignal,colliders:SimulationColliders)=>VisualBinding|Promise<VisualBinding>;
}
export interface WorldAssetOptions extends Omit<SimulationOptions,'rapier'> {id?:string;position?:PhysicsVector;rotation?:PhysicsRotation}
export interface SimulationAsset<W=object,B=BodyPose> extends Simulation<W,B> {readonly id:string;readonly snapshot:PhysicsSnapshot}
export interface SimulationHooks {
 filterContactPair(collider1:number,collider2:number,body1:number,body2:number):number|null;
 filterIntersectionPair(collider1:number,collider2:number,body1:number,body2:number):boolean;
}
/** The host calls afterStep after physics and dispose before freeing its world. */
export interface SimulationWorldExtension {hooks:SimulationHooks;afterStep():void;dispose():void}
export interface SimulationWorld<W=object,B=BodyPose> {
 readonly ownsWorld:boolean;readonly hooks:SimulationHooks;sync():void;
 readonly metersPerUnit:number;readonly kilogramsPerUnit:number;readonly world:W;readonly assets:ReadonlyMap<string,SimulationAsset<W,B>>;
 addAsset(options:WorldAssetOptions):Promise<SimulationAsset<W,B>>;removeAsset(id:string):boolean;step(dt?:number):void;dispose():void;
}
export function createSimulation<R extends RapierModule>(options:Omit<SimulationOptions,'rapier'>&{rapier:R}):Promise<Simulation<WorldOf<R>,BodyOf<R>>>;
/** World coordinates are Y-up. A borrowed world retains its settings, stepping and event ownership. */
export function createSimulationWorld<R extends RapierModule>(options:{rapier:R;world?:WorldOf<R>;registerWorldExtension?:(extension:SimulationWorldExtension)=>()=>void;gravity?:PhysicsVector;timestep?:number;metersPerUnit?:number;kilogramsPerUnit?:number}):SimulationWorld<WorldOf<R>,BodyOf<R>>;
export function getSimulationLimitations(snapshot:PhysicsSnapshot):PhysicsIssue[];
export function shiftInertiaToCenterOfMass(diagonalInertia:PhysicsVector|{x:number;y:number;z:number},principalAxes:PhysicsRotation|{x:number;y:number;z:number;w:number},mass:number,oldCenterOfMass:PhysicsVector|{x:number;y:number;z:number},newCenterOfMass:PhysicsVector|{x:number;y:number;z:number}):{diagonalInertia:import('three').Vector3;principalAxes:import('three').Quaternion};
