import type {Object3D} from 'three';
import type {BodyPose,Mechanism} from './kinematics.js';
import type {PhysicsBody} from './index.js';
export interface ObjectBinding {object:Object3D;body:string;instanceIndex?:number|null}
export function bindVisuals(options:{root:Object3D;bodies:ReadonlyMap<string,{data:PhysicsBody;body:BodyPose}>;bindings:ObjectBinding[];worldSpace?:boolean}):{sync():void;reset():void;bodyForObject(object:Object3D,instanceIndex?:number):{data:PhysicsBody;body:BodyPose}|null};
export function createJointHelpers(mechanism:Mechanism&{root:Object3D},options?:{visible?:(path:string,bodyPath:string)=>boolean;selected?:(path:string,bodyPath:string)=>boolean}):{objects:Object3D[];update():void;dispose():void};

export function placeAssetRoot(root:Object3D,snapshot:import('./index.js').PhysicsSnapshot,world:{metersPerUnit:number},options?:{position?:import('./index.js').PhysicsVector;rotation?:import('./index.js').PhysicsRotation}):{reset():void};

export function withVisualController<T extends {dispose():void}>(root:Object3D,create:()=>T|Promise<T>):Promise<T>;
