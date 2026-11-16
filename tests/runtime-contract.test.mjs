import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSimreadyRuntimeExtension} from '../src/index.js';
import {registerSimreadyLoader,getSimreadyRuntime} from '../src/gltf.js';
const source=()=>({bodies:[{path:'/Body',position:[0,1,0],rotation:[0,0,0,1],mass:2,gravityScale:0,continuousCollision:false,physx:{vendor:'do not archive'},attributes:[{name:'xformOp:transform',value:[]}]}],shapes:[],joints:[],groups:[],materials:[],scenes:[],unsupported:[],usdMetadata:{prims:[{source:'forbidden'}]}});
const options=()=>({snapshot:source(),stageNode:0,bindings:[{node:1,path:'/Body',instance:{rawUsd:'forbidden'}}],semantics:[{path:'/Body',taxonomy:'class',labels:['cabinet']}]});
const asset=payload=>({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{children:[1]},{}],extensionsUsed:['NEEDLE_simready'],extensionsRequired:['NEEDLE_simready'],extensions:{NEEDLE_simready:payload}});
const load=payload=>registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(asset(payload)),'');
test('runtime export has a closed vocabulary and drops source property bags',async()=>{
 const data=createSimreadyRuntimeExtension(options());
 assert.equal(data.version,3);assert.equal(data.usdMetadata,undefined);assert.equal(data.metadataBuffers,undefined);assert.equal(data.snapshot.usdMetadata,undefined);
 assert.equal(data.snapshot.bodies[0].physx,undefined);assert.equal(data.snapshot.bodies[0].attributes,undefined);assert.equal(data.bindings[0].instance,undefined);
 assert.equal(data.snapshot.bodies[0].mass,2);assert.equal(data.snapshot.bodies[0].gravityScale,0);assert.equal(data.snapshot.bodies[0].continuousCollision,false);
 const loaded=await load(data),runtime=getSimreadyRuntime(loaded);
 assert.equal(runtime.usdMetadata,undefined);assert.deepEqual(runtime.semantics,data.semantics);assert.deepEqual(loaded.scene.children[0].children[0].userData.simreadyLabels,[{taxonomy:'class',labels:['cabinet']}]);
 const mechanism=await runtime.createMechanism();try{assert.equal(mechanism.bodies.size,1);}finally{mechanism.dispose();}
});
test('runtime import rejects source-data leakage instead of treating it as a feature',async()=>{
 for(const edit of [p=>p.usdMetadata={prims:[]},p=>p.metadataBuffers=[],p=>p.snapshot.bodies[0].physxProperties={},p=>p.bindings[0].instance={source:'USD'},p=>p.semantics[0].attributes=[],p=>p.semantics[0].path='/Missing']){
  const data=createSimreadyRuntimeExtension(options());edit(data);await assert.rejects(load(data),/Invalid|Source/);
 }
});
test('runtime contract handles arbitrary JSON key ordering and rejects unknown semantic targets',async()=>{
 const data=createSimreadyRuntimeExtension(options());data.snapshot.bodies[0]=Object.fromEntries(Object.entries(data.snapshot.bodies[0]).reverse());await load(data);
 assert.throws(()=>createSimreadyRuntimeExtension({...options(),semantics:[{path:'/Absent',taxonomy:'class',labels:['cabinet']}]}),/Invalid/);
});
