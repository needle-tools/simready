// @ts-check
import {isRecord,isWireSnapshot,isBinding,isIssue} from '../validation.js';
// This is an interchange vocabulary, not a serialization of a source object's
// properties. Adding a runtime feature requires an explicit field here.
const mass=['mass','density','centerOfMass','diagonalInertia','principalAxes'];
const fields={
 bodies:['path','position','rotation','scale','rigidBodyEnabled','kinematicBody','startsAsleep','linearVelocity','angularVelocity','linearDamping','angularDamping','gravityScale','continuousCollision','filteredCollisions','simulationOwners',...mass],
 shapes:['path','type','body','position','rotation','scale','collisionEnabled','simulationOwners','materials','filteredCollisions','collisionGroups','halfExtents','radius','halfHeight','axis','approximation','meshScale','mesh',...mass],
 joints:['path','type','body0','body1','position0','position1','rotation0','rotation1','jointEnabled','collisionEnabled','excludeFromArticulation','axis','referenceAngle','limit','drive','minEnabled','maxEnabled','breakForce','breakTorque','minDistance','maxDistance','mimic'],
 materials:['path','staticFriction','dynamicFriction','restitution','density'],
 groups:['path','filteredGroups','invertFilteredGroups','mergedGroups'],
 scenes:['path','gravityDirection','gravityMagnitude'],
 articulations:['path','rootPrims','filteredCollisions','articulatedJoints','articulatedBodies'],
 unsupported:['path','type','reason'],
};
const nested={limit:['enabled','lower','upper'],drive:['enabled','targetPosition','targetVelocity','stiffness','damping','acceleration','forceLimit'],mimic:['joint','multiplier','offset']};
/** @param {Record<string,any>} value @param {string[]} keys */
const select=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
/** @param {import('../index.js').WireSnapshot} source @returns {import('../index.js').WireSnapshot} */
export function runtimeSnapshot(source){
 const input=/** @type {Record<string,any>} */(source);
 const result=Object.fromEntries(Object.entries(fields).filter(([key])=>input[key]!==undefined).map(([key,keys])=>[key,input[key].map((/** @type {Record<string,any>} */ item)=>select(item,keys))]));
 for(const joint of result.joints??[])for(const [key,keys]of Object.entries(nested))if(joint[key])joint[key]=select(joint[key],keys);
 return /** @type {import('../index.js').WireSnapshot} */(result);
}
/** @param {import('../index.js').WireSnapshot} source */
export function isRuntimeSnapshot(source){
 /** @param {unknown} value @returns {unknown} */
 const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(/** @type {Record<string,unknown>} */(value)[key])])):value;
 return JSON.stringify(sorted(source))===JSON.stringify(sorted(runtimeSnapshot(source)));
}
/** @param {unknown} value @returns {value is import('../index.js').SimreadySemanticLabels[]} */
export function isRuntimeSemantics(value){
 return Array.isArray(value)&&value.every(row=>row&&typeof row==='object'&&!Array.isArray(row)
  &&Object.keys(row).every(key=>['path','taxonomy','labels'].includes(key))&&typeof row.path==='string'&&row.path.length>0&&typeof row.taxonomy==='string'&&row.taxonomy.length>0
  &&Array.isArray(row.labels)&&row.labels.length>0&&row.labels.every((/** @type {unknown} */ label)=>typeof label==='string'&&label.length>0));
}

/** @param {unknown} value @returns {value is import('../index.js').SimreadyRuntimeExtension} */
export function isRuntimeExtension(value){
 if(!isRecord(value)||value.version!==1||!Number.isInteger(value.stageNode)||Number(value.stageNode)<0
  ||Object.keys(value).some(key=>!['version','stageNode','snapshot','bindings','semantics','mappingIssues','extensions','extras'].includes(key))
  ||!isWireSnapshot(value.snapshot)||!isRuntimeSnapshot(value.snapshot)
  ||!Array.isArray(value.bindings)||!value.bindings.every(binding=>isBinding(binding)&&Object.keys(binding).every(key=>['node','path','body'].includes(key)))
  ||!isRuntimeSemantics(value.semantics)||!Array.isArray(value.mappingIssues)||!value.mappingIssues.every(isIssue))return false;
 const bindings=value.bindings,bodies=new Set(value.snapshot.bodies.map(body=>body.path));
 return bindings.every(binding=>!binding.body||bodies.has(binding.body))
  &&value.semantics.every(record=>bindings.some(binding=>binding.path===record.path));
}
