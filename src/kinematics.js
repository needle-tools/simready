// @ts-check

/** @typedef {import('./index.js').PhysicsBody} PhysicsBody */
/** @typedef {import('./index.js').PhysicsJoint} PhysicsJoint */
/** @typedef {import('./index.js').PhysicsSnapshot} PhysicsSnapshot */
/** @typedef {import('./index.js').PhysicsIssue} PhysicsIssue */
/** @typedef {{translation():{x:number;y:number;z:number};
rotation():{x:number;y:number;z:number;w:number};
isDynamic():boolean}} BodyPose */
/** @typedef {Map<string,{data:PhysicsBody;body:BodyPose}>} MechanismBodies */
/** @typedef {import('./kinematics-types.js').Link} Link */
/** @typedef {import('./kinematics-types.js').Joint} Joint */
/** @typedef {import('./rapier.js').VisualBinding} VisualBinding */
/** @typedef {{data:PhysicsBody,body:BodyPose,link:Link,position:Vector3,rotation:Quaternion}} BodyRecord */
/** @typedef {{data:PhysicsJoint,joint:Joint,sign:number,angular:boolean,dof:number|null,
 * parent:string,child:string,closure:boolean,lower:number,upper:number,initial:number}} JointRecord */
/** @typedef {Awaited<ReturnType<typeof createMechanism>>} Mechanism */
/** @typedef {{snapshot:PhysicsSnapshot,loadKinematics?:()=>Promise<unknown>,
 * bindVisuals?:(bodies:MechanismBodies,warn:(item:{path:string,type?:string},reason:string)=>void)=>VisualBinding|Promise<VisualBinding>}} MechanismOptions */

import {Matrix4,Quaternion,Vector3} from 'three';
import {loadKinematicsModule} from './kinematics-types.js';
import {validateSnapshot} from './index.js';
const emptyVisualBinding={sync(){},reset(){},bodyForObject(){return null;}};

const unit=new Vector3(1,1,1), identity=new Matrix4();
/** @param {import('./index.js').PhysicsVector} [position] @param {import('./index.js').PhysicsRotation} [rotation] */
const pose=(position=[0,0,0],rotation=[0,0,0,1])=>{
 if(position.length!==3||rotation.length!==4||!position.every(Number.isFinite)||!rotation.every(Number.isFinite)||new Quaternion(...rotation).lengthSq()<1e-12)throw new Error('Invalid kinematic joint/body pose.');
 return new Matrix4().compose(new Vector3(...position),new Quaternion(...rotation).normalize(),unit);
};
/** @param {PhysicsJoint} joint @param {0|1} end */
const frame=(joint,end)=>pose(joint[end===0?'position0':'position1'],joint[end===0?'rotation0':'rotation1']);
/** @param {string|undefined} name */
const axis=name=>new Vector3(...(name==='Y'?[0,1,0]:name==='Z'?[0,0,1]:[1,0,0]));
/** @param {import('./kinematics-types.js').Frame} target @param {Matrix4} matrix */
function setFrame(target,matrix){const p=new Vector3(),q=new Quaternion();matrix.decompose(p,q,new Vector3());target.setPosition(p.x,p.y,p.z);target.setQuaternion(q.x,q.y,q.z,q.w);}
/** @param {Link} link */
const rigid=link=>new Matrix4().fromArray(link.matrixWorld);

/** Bounded USD joint manipulation. The optional IK core has no physics/WASM runtime. */
/** @param {MechanismOptions} options */
export async function createMechanism({snapshot,bindVisuals,loadKinematics}){
 snapshot=Object.assign({bodies:[],shapes:[],joints:[],materials:[],groups:[],scenes:[]},snapshot);
 validateSnapshot(snapshot);
 snapshot={...snapshot,joints:[...(snapshot.joints||[])]};
 const {Link,Joint,Solver,DOF}=await loadKinematicsModule(loadKinematics);
 /** @type {PhysicsIssue[]} */
 const unsupported=[];
 /** @type {Map<string,BodyRecord>} */
 const bodies=new Map();
 /** @type {Map<string,JointRecord>} */
 const joints=new Map(),parents=new Map();
 const world=new Link();
 /** @type {string[]} */
 const roots=[];
 /** @type {Map<string,PhysicsJoint[]>} */
 const edges=new Map();
 /** @type {JointRecord[]} */
 const closures=[];
 /** @param {string} path */
 function body(path){const record=bodies.get(path);if(!record)throw new Error('Unavailable mechanism body: '+path);return record;}
 /** @param {{path:string,type?:string}} data @param {string} reason */
 const warn=(data,reason)=>unsupported.push({path:data.path,type:data.type,reason});
 /** @type {{record:JointRecord,point:Vector3,pivot:Vector3,axis:Vector3,initial:number,angle:number}|null} */
 let drag=null;
 /** @type {VisualBinding|undefined} */
 let visuals;
 let playing=false,disposed=false,valid=true;
 const scale=(snapshot.metersPerUnit??0)>0?snapshot.metersPerUnit??1:1;
 const tolerance=Math.max(1e-6,1e-5/scale);
 try{
  for(const data of snapshot.bodies||[]){
   const link=new Link();link.name=data.path;
   const position=new Vector3(...data.position),rotation=new Quaternion(...data.rotation);
   const body={translation:()=>position,rotation:()=>rotation,isDynamic:()=>!!jointForBody(data.path)};
   bodies.set(data.path,{data,body,link,position,rotation});edges.set(data.path,[]);
  }
  edges.set('',[]);
  const descriptors=(snapshot.joints||[]).filter(j=>j.jointEnabled!==false);
  for(const data of descriptors){
   if(!['fixed','revolute','prismatic'].includes(data.type)){warn(data,'Joint type is not supported for manipulation.');continue;}
   if(!edges.has(data.body0||'')||!edges.has(data.body1||'')){warn(data,'Joint references a body outside this mechanism.');continue;}
   edges.get(data.body0||'')?.push(data);edges.get(data.body1||'')?.push(data);
  }
  /** @param {PhysicsJoint} data @param {string} parent @param {string} child */
  function attach(data,parent,child,reversed=false,closure=false){
   const joint=new Joint(),sign=reversed?-1:1,angular=data.type==='revolute',dof=data.type==='fixed'?null:(angular?{X:DOF.EX,Y:DOF.EY,Z:DOF.EZ}:{X:DOF.X,Y:DOF.Y,Z:DOF.Z})[data.axis||'X'];
   joint.name=data.path;setFrame(joint,frame(data,reversed?1:0));if(dof!==null)joint.setDoF(dof);
   const record={data,joint,sign,angular,dof,parent,child,closure,lower:-Infinity,upper:Infinity,initial:0};
   const a=(parent?pose(body(parent).data.position,body(parent).data.rotation):identity).clone().multiply(frame(data,reversed?1:0));
   const b=(child?pose(body(child).data.position,body(child).data.rotation):identity).clone().multiply(frame(data,reversed?0:1));
   const relative=a.clone().invert().multiply(b),p=new Vector3(),q=new Quaternion();relative.decompose(p,q,new Vector3());
   let value=0;
   if(dof!==null){const v=axis(data.axis);value=angular?2*Math.atan2(new Vector3(q.x,q.y,q.z).dot(v),q.w):p.dot(v);
    if(angular&&data.limit?.enabled&&typeof data.limit.lower==='number'&&typeof data.limit.upper==='number'&&Number.isFinite(data.limit.lower)&&Number.isFinite(data.limit.upper)) {
     const degrees=value*180/Math.PI*sign;
     const first=Math.ceil((data.limit.lower-degrees-1e-5)/360),last=Math.floor((data.limit.upper-degrees+1e-5)/360);
     if(first<=last)value+=Math.max(first,Math.min(last,0))*2*Math.PI*sign;
    }
    joint.setDoFValue(dof,value);}
   record.initial=value*sign*(angular?180/Math.PI:1);
   if(data.limit?.enabled){record.lower=typeof data.limit.lower==='number'&&Number.isFinite(data.limit.lower)?data.limit.lower:-Infinity;record.upper=typeof data.limit.upper==='number'&&Number.isFinite(data.limit.upper)?data.limit.upper:Infinity;}
   // Body-frame relations own the articulation; USD prim ancestry does not.
   const parentLink=parent?body(parent).link:world;parentLink.addChild(joint);
   if(closure){
    const target=new Link(),fixed=new Joint();setFrame(fixed,frame(data,1));(child?body(child).link:world).addChild(fixed);fixed.addChild(target);joint.makeClosure(target);closures.push(record);
   }else{
    const link=body(child).link;setFrame(link,frame(data,reversed?0:1).invert());joint.addChild(link);parents.set(child,record);
   }
   joints.set(data.path,record);return record;
  }
  // Start each component at its world/static body or authored directed root.
  const visited=new Set(['']),used=new Set();
  /** @param {string} start */
  function walk(start){
   const pending=[start];
   while(pending.length){const parent=pending.shift();if(parent===undefined)break;for(const data of edges.get(parent)||[]){if(used.has(data.path))continue;used.add(data.path);
    const reversed=(data.body1||'')===parent,child=(reversed?data.body0:data.body1)||'';
    if(visited.has(child)){if(!reversed)attach(data,parent,child,false,true);else attach(data,child,parent,false,true);continue;}
    visited.add(child);attach(data,parent,child,reversed);pending.push(child);
   }}
  }
  walk('');
  while(visited.size<bodies.size+1){
   const candidates=[...bodies.values()].filter(item=>!visited.has(item.data.path));
   candidates.sort((a,b)=>{
    /** @param {BodyRecord} item */
    const rank=item=>item.data.rigidBodyEnabled===false||item.data.kinematicBody?-1:(edges.get(item.data.path)||[]).filter(j=>j.body1===item.data.path).length;
    return rank(a)-rank(b)||a.data.path.localeCompare(b.data.path);
   });
   const base=candidates[0],fixed=new Joint();world.addChild(fixed);fixed.addChild(base.link);setFrame(base.link,pose(base.data.position,base.data.rotation));roots.push(base.data.path);visited.add(base.data.path);walk(base.data.path);
  }
  /** @param {JointRecord} record */
  function setLimits(record){
   if(record.dof===null)return;const factor=(record.angular?Math.PI/180:1)*record.sign;
   record.joint.setMinLimit(record.dof,Math.min(record.lower*factor,record.upper*factor));record.joint.setMaxLimit(record.dof,Math.max(record.lower*factor,record.upper*factor));
  }
  for(const record of joints.values())setLimits(record);
  /** @param {JointRecord} record */
  function value(record){return record.dof===null?0:record.joint.getDoFValue(record.dof)*record.sign*(record.angular?180/Math.PI:1);}
  /** @param {JointRecord|undefined} record @param {Set<JointRecord>} [seen] @returns {JointRecord|null} */
  function source(record,seen=new Set()){
   if(!record||seen.has(record))return null;seen.add(record);
   return record.data.mimic?source(joints.get(record.data.mimic.joint),seen):record;
  }
  /** @param {JointRecord|undefined} record @param {Set<JointRecord>} [seen] @returns {{root:JointRecord,gain:number,offset:number}|null} */
  function coupling(record,seen=new Set()){
   if(!record||seen.has(record))return null;seen.add(record);const dep=record.data.mimic;
   if(!dep)return{root:record,gain:1,offset:0};const parent=coupling(joints.get(dep.joint),seen);
   return parent?{root:parent.root,gain:parent.gain*dep.multiplier,offset:parent.offset*dep.multiplier+dep.offset}:null;
  }
  for(const record of joints.values())if(record.data.mimic){
   const relation=coupling(record);
   if(!relation||!Number.isFinite(relation.gain)||!Number.isFinite(relation.offset)||record.dof===null||relation.root.dof===null){warn(record.data,'Mimic dependency is cyclic or unavailable.');valid=false;continue;}
   if(Math.abs(record.initial-(relation.root.initial*relation.gain+relation.offset))>tolerance){warn(record.data,'Authored poses do not satisfy the mimic relationship.');valid=false;}
   if(relation.gain!==0){const a=(record.lower-relation.offset)/relation.gain,b=(record.upper-relation.offset)/relation.gain;
    relation.root.lower=Math.max(relation.root.lower,Math.min(a,b));relation.root.upper=Math.min(relation.root.upper,Math.max(a,b));
    if(relation.root.lower>relation.root.upper){warn(record.data,'Mimic joint limits have no common range.');valid=false;}else setLimits(relation.root);
   }
  }
  function mimic(){
   const done=new Set();
   /** @param {JointRecord} record */
  function apply(record){if(done.has(record))return;done.add(record);const dep=record.data.mimic;if(!dep)return;const ref=joints.get(dep.joint);if(!ref||!source(record))return;apply(ref);const v=value(ref)*dep.multiplier+dep.offset;
    if(record.dof!==null)record.joint.setDoFValue(record.dof,record.sign*v*(record.angular?Math.PI/180:1));
   }
   for(const record of joints.values())if(record.dof!==null)apply(record);
  }
  let solver=closures.length?new Solver(world):null;
  if(solver){solver.maxIterations=30;solver.translationConvergeThreshold=tolerance;solver.rotationConvergeThreshold=1e-5;solver.useSVD=true;}
  /** @param {string} path @returns {JointRecord|null} */
  function jointForBody(path){
   let record=parents.get(path),seen=new Set();
   while(record&&!seen.has(record)){seen.add(record);if(record.dof!==null&&record.lower<record.upper&&coupling(record)?.gain!==0)return source(record)?record:null;record=parents.get(record.parent);}
   return null;
  }
  function updatePoses(){world.updateMatrixWorld(true);for(const item of bodies.values())rigid(item.link).decompose(item.position,item.rotation,new Vector3());}
  updatePoses();
  // Reject inconsistent frames before binding, rather than snapping apart a model.
  for(const item of bodies.values())if(item.position.distanceTo(new Vector3(...item.data.position))>tolerance*10||item.rotation.angleTo(new Quaternion(...item.data.rotation))>1e-3){warn(item.data,'Authored joint frames do not agree with this body pose.');valid=false;}
  const binding=await bindVisuals?.(bodies,warn)||emptyVisualBinding;visuals=binding;
  function sync(){updatePoses();binding.sync();}
  function closeEnough(){
   return closures.every(({joint})=>{const p=new Float64Array(3),r=new Float64Array(3);joint.getClosureError(p,r);return Math.hypot(...p)<tolerance*5&&Math.hypot(...r)<1e-4;});
  }
  /** @param {JointRecord} record @param {number} next @returns {boolean} */
  function setValue(record,next){
   if(!valid||!Number.isFinite(next))return false;
   const dep=record.data.mimic;if(dep){const ref=joints.get(dep.joint);return ref&&dep.multiplier!==0?setValue(ref,(next-dep.offset)/dep.multiplier):false;}
   if(record.dof===null)return false;
   const before=[...joints.values()].flatMap(r=>r.dof===null?[]:[{record:r,dof:r.dof,value:r.joint.getDoFValue(r.dof)}]);
   record.joint.setDoFValue(record.dof,record.sign*Math.max(record.lower,Math.min(record.upper,next))*(record.angular?Math.PI/180:1));mimic();
   if(solver){
    const target=record.joint.getDoFValue(record.dof),min=record.joint.minDoFLimit[record.dof],max=record.joint.maxDoFLimit[record.dof];
    record.joint.setMinLimit(record.dof,target);record.joint.setMaxLimit(record.dof,target);solver.solve();mimic();
    record.joint.setMinLimit(record.dof,min);record.joint.setMaxLimit(record.dof,max);world.updateMatrixWorld(true);
    if(!closeEnough()){for(const saved of before)saved.record.joint.setDoFValue(saved.dof,saved.value);sync();return false;}
   }
   sync();return true;
  }
  return {
   mode:/** @type {const} */('interaction'),bodies,joints,unsupported,roots,metersPerUnit:scale,
   play(){if(!disposed)playing=true;},pause(){playing=false;drag=null;},isPlaying:()=>playing,
   /** @param {number} [_dt] */
   update(_dt){},
   /** @param {string} path */
   getJointValue(path){const record=joints.get(path);return record?.dof!==null&&record?value(record):null;},
   /** @param {string} path @param {number} next */
   setJointValue(path,next){const record=joints.get(path);return !!record&&setValue(record,next);},
   jointForBody,
   /** @param {import('three').Object3D} object @param {number} [index] */
   bodyForObject(object,index){return valid?binding.bodyForObject(object,index):null;},
   /** @param {string} path @param {import('three').Vector3Like} position */
   beginDrag(path,position){
    const record=jointForBody(path);if(!playing||!valid||!record)return false;
    updatePoses();const parent=record.parent?rigid(body(record.parent).link):identity;
    const origin=parent.clone().multiply(frame(record.data,record.sign<0?1:0)),p=new Vector3(),q=new Quaternion();origin.decompose(p,q,new Vector3());
    drag={record,point:new Vector3().copy(position),pivot:p,axis:axis(record.data.axis).applyQuaternion(q),initial:value(record),angle:0};return true;
   },
   /** @param {import('three').Vector3Like} position */
   moveDrag(position){
    if(!drag)return;const{record,axis,pivot,point,initial}=drag;let delta;
    if(record.angular){const a=point.clone().sub(pivot).projectOnPlane(axis),b=new Vector3().copy(position).sub(pivot).projectOnPlane(axis);if(a.lengthSq()<1e-12||b.lengthSq()<1e-12)return;
     let angle=Math.atan2(axis.dot(a.clone().cross(b)),a.dot(b));angle+=Math.round((drag.angle-angle)/(2*Math.PI))*2*Math.PI;drag.angle=angle;delta=angle*180/Math.PI;
    }else delta=new Vector3().copy(position).sub(point).dot(axis);
    setValue(record,initial+delta*record.sign);
   },
   endDrag(){drag=null;},
   reset(){drag=null;playing=false;for(const record of joints.values())if(record.dof!==null)record.joint.setDoFValue(record.dof,record.initial*record.sign*(record.angular?Math.PI/180:1));updatePoses();binding.reset();},
   dispose(){if(disposed)return;this.reset();disposed=true;},
  };
 }catch(error){visuals?.reset();throw error;}
}
