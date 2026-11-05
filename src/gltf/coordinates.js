// @ts-check
import {Quaternion} from 'three';
import {transformSnapshot} from '../transform.js';
import {validateSnapshot} from '../index.js';

const radians=Math.PI/180;
/** @param {import('../index.js').PhysicsJoint} joint */
const angular=joint=>joint.type==='revolute'||joint.type==='spherical';

/** Convert a runtime physics descriptor to glTF metres, kilograms, Y-up and radians.
 * Collision points remain available until the producer writes their glTF meshes.
 * @param {import('../index.js').PhysicsSnapshot} source
 * @returns {import('../index.js').GltfPhysicsSnapshot}
 */
export function toGltfPhysicsSnapshot(source){
 validateSnapshot(source);
 const length=source.metersPerUnit??.01,mass=source.kilogramsPerUnit??1;
 if(!Number.isFinite(length)||length<=0||!Number.isFinite(mass)||mass<=0||!['X','Y','Z'].includes(source.upAxis??'Y'))throw new TypeError('Invalid physics source coordinates or units.');
 for(const joint of source.joints)if(!['fixed','revolute','prismatic','spherical','distance'].includes(joint.type)&&(joint.limit||joint.drive||joint.mimic))throw new TypeError('Cannot convert dimensional parameters of unknown joint type: '+joint.type);
 normalizeRotations(source,false);
 const snapshot=transformSnapshot(source);normalizeRotations(snapshot);
 convertAngles(snapshot,radians);
 const {metersPerUnit,kilogramsPerUnit,upAxis,...gltf}=snapshot;
 return gltf;
}

/** Adapt glTF data to the runtime APIs, whose angular controls use degrees.
 * @param {import('../index.js').GltfPhysicsSnapshot} source
 * @returns {import('../index.js').PhysicsSnapshot}
 */
export function fromGltfPhysicsSnapshot(source){
 const snapshot=structuredClone(source);
 validateSnapshot(snapshot);normalizeRotations(snapshot);convertAngles(snapshot,1/radians);
 return {...snapshot,metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y'};
}

/** @param {import('../index.js').PhysicsSnapshot} snapshot @param {number} factor */
function convertAngles(snapshot,factor){
 for(const body of snapshot.bodies)if(body.angularVelocity)body.angularVelocity=/** @type {[number,number,number]} */(body.angularVelocity.map(value=>value*factor));
 for(const joint of snapshot.joints){
  const isAngular=angular(joint);
  if(isAngular){
   if(joint.limit)for(const key of /** @type {const} */(['lower','upper'])){const value=joint.limit[key];if(value!==null)joint.limit[key]=value*factor;}
   if(joint.drive){
    joint.drive.targetPosition*=factor;joint.drive.targetVelocity*=factor;
    if(!joint.drive.acceleration){joint.drive.stiffness/=factor;joint.drive.damping/=factor;}
   }
  }
  if(joint.mimic){
   const reference=snapshot.joints.find(item=>item.path===joint.mimic?.joint);
   if(!reference)throw new TypeError('Mimic reference is unavailable: '+joint.mimic.joint);
   joint.mimic.multiplier*=(isAngular?factor:1)/(angular(reference)?factor:1);
   if(isAngular)joint.mimic.offset*=factor;
  }
 }
}

/** @param {import('../index.js').PhysicsSnapshot} snapshot @param {boolean} [apply] */
function normalizeRotations(snapshot,apply=true){
 /** @param {import('../index.js').PhysicsRotation|undefined} value */
 const normalize=value=>{
  if(!value)return;
  if(!value.every(Number.isFinite)||!value.some(Boolean))throw new TypeError('Invalid physics rotation.');
  if(!apply)return;
  const q=new Quaternion(...value).normalize();value.splice(0,4,q.x,q.y,q.z,q.w);
 };
 for(const body of snapshot.bodies){normalize(body.rotation);normalize(body.principalAxes);}
 for(const shape of snapshot.shapes){normalize(shape.rotation);normalize(shape.principalAxes);}
 for(const joint of snapshot.joints){normalize(joint.rotation0);normalize(joint.rotation1);}
}
