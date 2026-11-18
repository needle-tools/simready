import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSimreadyRuntimeExtension} from '../src/index.js';
import {registerSimreadyLoader,getSimreadyRuntime,toGltfPhysicsSnapshot,fromGltfPhysicsSnapshot} from '../src/gltf.js';
const source=()=>({bodies:[{path:'/Body',position:[0,1,0],rotation:[0,0,0,1],mass:2,gravityScale:0,continuousCollision:false,physx:{vendor:'do not archive'},attributes:[{name:'xformOp:transform',value:[]}]}],shapes:[],joints:[],groups:[],materials:[],scenes:[],unsupported:[]});
const options=()=>({snapshot:source(),stageNode:0,bindings:[{node:1,path:'/Body',instance:{rawUsd:'forbidden'}}],semantics:[{path:'/Body',taxonomy:'class',labels:['cabinet']}]});
const asset=payload=>({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{children:[1]},{}],extensionsUsed:['NEEDLE_simready'],extensionsRequired:['NEEDLE_simready'],extensions:{NEEDLE_simready:payload}});
const load=payload=>registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(asset(payload)),'');
test('runtime export has a closed vocabulary and drops source property bags',async()=>{
 const data=createSimreadyRuntimeExtension(options());
 assert.equal(data.version,3);
 assert.equal(data.snapshot.bodies[0].physx,undefined);assert.equal(data.snapshot.bodies[0].attributes,undefined);assert.equal(data.bindings[0].instance,undefined);
 assert.equal(data.snapshot.bodies[0].mass,2);assert.equal(data.snapshot.bodies[0].gravityScale,0);assert.equal(data.snapshot.bodies[0].continuousCollision,false);
 const loaded=await load(data),runtime=getSimreadyRuntime(loaded);
 assert.deepEqual(runtime.semantics,data.semantics);assert.deepEqual(loaded.scene.children[0].children[0].userData.simreadyLabels,[{taxonomy:'class',labels:['cabinet']}]);
 const mechanism=await runtime.createMechanism();try{assert.equal(mechanism.bodies.size,1);}finally{mechanism.dispose();}
});
test('runtime import validates the closed descriptor fields',async()=>{
 for(const edit of [p=>p.unknownField={},p=>p.snapshot.unknownField=[],p=>p.snapshot.bodies[0].physxProperties={},p=>p.bindings[0].instance={source:'USD'},p=>p.semantics[0].attributes=[],p=>p.semantics[0].path='/Missing']){
  const data=createSimreadyRuntimeExtension(options());edit(data);await assert.rejects(load(data),/Invalid/);
 }
});
test('runtime contract handles arbitrary JSON key ordering and rejects unknown semantic targets',async()=>{
 const data=createSimreadyRuntimeExtension(options());data.snapshot.bodies[0]=Object.fromEntries(Object.entries(data.snapshot.bodies[0]).reverse());await load(data);
 assert.throws(()=>createSimreadyRuntimeExtension({...options(),semantics:[{path:'/Absent',taxonomy:'class',labels:['cabinet']}]}),/Invalid/);
});

test('authored full-turn references survive the closed glTF runtime contract',async()=>{
 const snapshot=source();snapshot.metersPerUnit=1;snapshot.bodies[0].position=[0,0,0];
 snapshot.joints.push({path:'/Turn',type:'revolute',body1:'/Body',axis:'Z',referenceAngle:720,limit:{enabled:true,lower:720,upper:1080}});
 const gltf=toGltfPhysicsSnapshot(snapshot);
 const data=createSimreadyRuntimeExtension({...options(),snapshot:gltf});
 assert.equal(data.snapshot.joints[0].referenceAngle,4*Math.PI);
 assert.equal(fromGltfPhysicsSnapshot(data.snapshot).joints[0].referenceAngle,720);
 const runtime=getSimreadyRuntime(await load(data)),mechanism=await runtime.createMechanism();
 try{assert.ok(Math.abs(mechanism.getJointValue('/Turn')-720)<1e-3);}
 finally{mechanism.dispose();}
});
