import {Quaternion,Vector3} from 'three';
/** @param {string | undefined} name */
const axis=name=>new Vector3(...(name==='Y'?[0,1,0]:name==='Z'?[0,0,1]:[1,0,0]));
/** @param {import('./kinematics.js').BodyPose | undefined} body @param {import('./index.js').PhysicsRotation | undefined} frame */
const orientation=(body,frame)=>new Quaternion().copy(body?.rotation()||{x:0,y:0,z:0,w:1}).multiply(new Quaternion(...(frame||[0,0,0,1])));
/** @param {import('./kinematics.js').BodyPose | undefined} body @param {import('./index.js').PhysicsVector | undefined} point */
const anchor=(body,point)=>new Vector3(...(point||[0,0,0])).applyQuaternion(new Quaternion().copy(body?.rotation()||{x:0,y:0,z:0,w:1})).add(body?.translation()||{x:0,y:0,z:0});
/**
 * Choose the equivalent authored turn without changing the measured pose.
 * Snapshots without a turn reference keep their existing limit-based branch.
 * @param {number} degrees @param {import('./index.js').PhysicsJoint} joint
 */
export function authoredAngle(degrees,joint) {
 const reference=joint.referenceAngle;
 const limit=joint.limit?.enabled ? joint.limit : null;
 const lower=limit?.lower,upper=limit?.upper;
 if(reference===undefined && !(Number.isFinite(lower)&&Number.isFinite(upper)))return degrees;
 const first=typeof lower==='number' ? Math.ceil((lower-degrees-1e-5)/360) : -Infinity;
 const last=typeof upper==='number' ? Math.floor((upper-degrees+1e-5)/360) : Infinity;
 if(first>last)return degrees;
 const turn=reference===undefined ? 0 : Math.round((reference-degrees)/360);
 return degrees+360*Math.max(first,Math.min(last,turn));
}

/** Measure authored joint coordinates from solved poses, in stage units/degrees. */
/** @param {import('./index.js').PhysicsJoint} data @param {ReadonlyMap<string, {body: import('./kinematics.js').BodyPose}>} bodies */
export function jointValue(data,bodies){
 const a=bodies.get(data.body0 ?? '')?.body,b=bodies.get(data.body1 ?? '')?.body;
 const frame0=orientation(a,data.rotation0),frame1=orientation(b,data.rotation1),direction=axis(data.axis);
 if(data.type==='prismatic')return anchor(b,data.position1).sub(anchor(a,data.position0)).dot(direction.applyQuaternion(frame0));
 if(data.type==='revolute'){
  const relative=frame0.invert().multiply(frame1);let value=2*Math.atan2(new Vector3(relative.x,relative.y,relative.z).dot(direction),relative.w)*180/Math.PI;
  value=((value+180)%360+360)%360-180;
  return authoredAngle(value,data);
 }
 return null;
}
