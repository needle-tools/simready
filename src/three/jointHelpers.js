// @ts-check
import {BufferGeometry,Float32BufferAttribute,Matrix4,Quaternion,Vector3} from 'three';
import {helperGeometry,disposeHelper} from './helperGeometry.js';

/** Joint axes, stops and angular limits in USD stage coordinates. */
/** @param {import('../kinematics.js').Mechanism & {root:import('three').Object3D}} mechanism
 * @param {{visible?:(path:string,body:string)=>boolean,selected?:(path:string,body:string)=>boolean}} [options] */
export function createJointHelpers(mechanism,{visible=()=>true,selected=()=>false}={}){
 /** @type {Array<{record:import('../kinematics.js').JointRecord,object:import('three').LineSegments<BufferGeometry,import('three').LineBasicMaterial>,markers:import('three').Points<BufferGeometry,import('three').PointsMaterial>}>} */
 const objects=[];
 const unit=new Vector3(1,1,1);
 const unitScale=mechanism.metersPerUnit||1;
 const radius=.08/unitScale;
 for(const record of mechanism.joints.values()){
  const object=helperGeometry('joints',record.data.path,[],false,0x99cc33);
  object.material.opacity=1;
  object.material.depthTest=false;object.renderOrder=1000;object.matrixAutoUpdate=false;
  const markers=helperGeometry('joints',record.data.path,[],true,object.material.color);
  markers.material.depthTest=false;markers.material.size=7;markers.renderOrder=1001;object.add(markers);
  object.userData.simreadyInteractBody=record.child;object.userData.simreadyJointPath=record.data.path;
  mechanism.root.add(object);objects.push({record,object,markers});
 }
 function update(){
  for(const{record,object,markers}of objects){
   object.visible=selected(record.data.path,record.child)||(visible(record.data.path,record.child)&&mechanism.isPlaying());if(!object.visible)continue;
   const parent=record.parent?mechanism.bodies.get(record.parent)?.body:null;
   const state=[mechanism.getJointValue(record.data.path),...(parent?Object.values(parent.translation()):[]),...(parent?Object.values(parent.rotation()):[])].join(',');
   if(object.userData.jointState===state)continue;object.userData.jointState=state;
   const world=new Matrix4().compose(parent?new Vector3().copy(parent.translation()):new Vector3(),parent?new Quaternion().copy(parent.rotation()):new Quaternion(),unit);
   const end=record.sign<0?1:0;world.multiply(new Matrix4().compose(new Vector3(...record.data[end===0?'position0':'position1']??[0,0,0]),new Quaternion(...record.data[end===0?'rotation0':'rotation1']??[0,0,0,1]),unit));
   object.matrix.copy(world);object.matrixWorldNeedsUpdate=true;
   const axis=new Vector3(...(record.data.axis==='Y'?[0,1,0]:record.data.axis==='Z'?[0,0,1]:[1,0,0])).multiplyScalar(record.sign);
   const u=new Vector3().crossVectors(axis,Math.abs(axis.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0)).normalize(),v=new Vector3().crossVectors(axis,u);
   /** @type {number[]} */
   const lines=[],dots=[];
   /** @param {Vector3} a @param {Vector3} b */
   const edge=(a,b)=>lines.push(...a,...b);
   /** @param {Vector3} p */
   const tick=p=>{edge(p.clone().addScaledVector(u,-radius*.13),p.clone().addScaledVector(u,radius*.13));edge(p.clone().addScaledVector(v,-radius*.13),p.clone().addScaledVector(v,radius*.13));};
   if(record.dof===null){
    dots.push(0,0,0);
    for(const direction of[axis,u,v])edge(direction.clone().multiplyScalar(-radius*.2),direction.clone().multiplyScalar(radius*.2));
   }else if(record.angular){
    const lower=Number.isFinite(record.lower)?record.lower:-180,upper=Number.isFinite(record.upper)?record.upper:180;
    /** @param {number} a */
    const at=a=>u.clone().multiplyScalar(Math.cos(a*Math.PI/180)*radius).addScaledVector(v,Math.sin(a*Math.PI/180)*radius);
    for(let i=0;i<48;i++)edge(at(lower+(upper-lower)*i/48),at(lower+(upper-lower)*(i+1)/48));
    edge(new Vector3(),at(lower));edge(new Vector3(),at(upper));
    const value=mechanism.getJointValue(record.data.path);if(value===null)continue;edge(new Vector3(),at(value));
    dots.push(...at(lower),...at(upper),...at(value));
    edge(axis.clone().multiplyScalar(-radius*.5),axis.clone().multiplyScalar(radius*.5));
   }else{
    const lower=Number.isFinite(record.lower)?record.lower:-radius,upper=Number.isFinite(record.upper)?record.upper:radius;
    const a=axis.clone().multiplyScalar(lower),b=axis.clone().multiplyScalar(upper);edge(a,b);tick(a);tick(b);
    edge(b,b.clone().addScaledVector(axis,-radius*.2).addScaledVector(u,radius*.12));edge(b,b.clone().addScaledVector(axis,-radius*.2).addScaledVector(u,-radius*.12));
    const value=mechanism.getJointValue(record.data.path);if(value===null)continue;
    const current=axis.clone().multiplyScalar(value);
    dots.push(...a,...b,...current);
    tick(current);edge(current.clone().addScaledVector(u,-radius*.25),current.clone().addScaledVector(u,radius*.25));
   }
   // Replace only when the pose/value changes, keeping idle interaction cheap.
   const key=lines.join(',');if(object.userData.geometryKey!==key){object.userData.geometryKey=key;const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(lines,3));object.geometry.dispose();object.geometry=geometry;}
   markers.geometry.dispose();markers.geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(dots,3));
  }
 }
 update();return{objects:objects.map(item=>item.object),update,dispose(){for(const{object}of objects)disposeHelper(object);}};
}
