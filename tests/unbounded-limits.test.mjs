import {test} from 'node:test';import assert from 'node:assert/strict';
import {describeSimulation,rapierCapabilities} from '../src/description.js';
import {toGltfPhysicsSnapshot,fromGltfPhysicsSnapshot} from '../src/gltf/coordinates.js';
const max=3.4028234663852886e38;
const snapshot=(breakForce=max,breakTorque=max)=>({metersPerUnit:.01,kilogramsPerUnit:.1,upAxis:'Y',scenes:[],materials:[],groups:[],shapes:[],bodies:[{path:'/Body',position:[0,0,0],rotation:[0,0,0,1]}],joints:[{path:'/Weld',type:'fixed',body1:'/Body',breakForce,breakTorque}]});
test('PhysX float-maximum breaking sentinels are unbounded rather than a missing breakage feature',()=>{
 const source=snapshot(),before=structuredClone(source),description=describeSimulation(source,{capabilities:rapierCapabilities()});
 assert.deepEqual(description.issues,[]);assert.equal(description.joints[0].breakForce,undefined);assert.deepEqual(source,before);
});
test('unbounded breaking thresholds survive unit conversion and a glTF round trip',()=>{
 const wire=toGltfPhysicsSnapshot(snapshot());assert.equal(wire.joints[0].breakForce,null);assert.equal(wire.joints[0].breakTorque,null);
 assert.deepEqual(describeSimulation(fromGltfPhysicsSnapshot(wire),{capabilities:rapierCapabilities()}).issues,[]);
});
test('real finite force and torque thresholds still report unavailable breakage support',()=>{
 const source=snapshot(2000,800),description=describeSimulation(source,{capabilities:rapierCapabilities()});
 assert.ok(description.issues.some(i=>i.reason==='Joint breaking thresholds are not supported.'));
 const wire=toGltfPhysicsSnapshot(source);assert.equal(wire.joints[0].breakForce,2);assert.equal(wire.joints[0].breakTorque,.008);
});
