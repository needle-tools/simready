import type {PhysicsBody,PhysicsJoint,PhysicsSnapshot,PhysicsIssue} from './index.js';
export interface BodyPose {translation():{x:number;y:number;z:number};rotation():{x:number;y:number;z:number;w:number};isDynamic():boolean}
export type MechanismBodies=Map<string,{data:PhysicsBody;body:BodyPose}>;
export interface Mechanism {
 readonly mode:'interaction';readonly metersPerUnit:number;readonly roots:string[];
 readonly bodies:MechanismBodies;
 readonly joints:ReadonlyMap<string,{data:PhysicsJoint;parent:string;child:string;angular:boolean;lower:number;upper:number}>;
 readonly unsupported:PhysicsIssue[];
 play():void;pause():void;isPlaying():boolean;update(dt?:number):void;reset():void;dispose():void;
 getJointValue(path:string):number|null;setJointValue(path:string,value:number):boolean;jointForBody(path:string):{data:PhysicsJoint}|null;
 bodyForObject(object:unknown,index?:number):{data:PhysicsBody;body:BodyPose}|null;
 beginDrag(path:string,position:{x:number;y:number;z:number}):boolean;moveDrag(position:{x:number;y:number;z:number}):void;endDrag():void;
}
export function createMechanism(options:{snapshot:PhysicsSnapshot;loadKinematics?:()=>Promise<unknown>;bindVisuals?:(bodies:MechanismBodies,warn:(data:{path:string;type?:string},reason:string)=>void)=>{sync():void;reset():void;bodyForObject(object:unknown,index?:number):{data:PhysicsBody;body:BodyPose}|null}|Promise<{sync():void;reset():void;bodyForObject(object:unknown,index?:number):{data:PhysicsBody;body:BodyPose}|null}>}):Promise<Mechanism>;
