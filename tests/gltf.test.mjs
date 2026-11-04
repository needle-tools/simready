import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Group} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSimreadyExtension} from '../src/index.js';
import {registerSimreadyLoader} from '../src/gltf.js';
import {withVisualController} from '../src/three.js';
import {createSimulationWorld} from '../src/rapier.js';
import R from '@dimforge/rapier3d-compat';
await R.init();
const q=[0,0,0,1],snapshot={metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],unsupported:[],bodies:[{path:'/Body',position:[0,0,0],rotation:q}],shapes:[],joints:[]};
async function asset(){const extension=createSimreadyExtension({snapshot,stageNode:0,bindings:[{node:1,path:'/Body'}]});return (await registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{children:[1]},{}],extensionsUsed:['NEEDLE_simready'],extensionsRequired:['NEEDLE_simready'],extensions:{NEEDLE_simready:extension}}),'')).userData.simready;}

test('a visual root has one pending or active controller, and failed setup releases ownership',async()=>{
 const root=new Group();let finish;
 const pending=withVisualController(root,()=>new Promise(resolve=>{finish=()=>resolve({dispose(){}});}));
 await assert.rejects(withVisualController(root,()=>({dispose(){}})),/active or pending/);
 finish();const controller=await pending;await assert.rejects(withVisualController(root,()=>({dispose(){}})),/active or pending/);
 controller.dispose();await assert.rejects(withVisualController(root,()=>{throw new Error('setup failed');}),/setup failed/);
 const next=await withVisualController(root,()=>({dispose(){}}));controller.dispose();next.dispose();
});

test('glTF controllers cannot overlap; stale disposal does not restore a newer placement',async()=>{
 const runtime=await asset(),host=createSimulationWorld({rapier:R,gravity:[0,0,0]});
 try{
  const first=await runtime.createSimulation({world:host,id:'first',position:[1,0,0]});
  await assert.rejects(runtime.createMechanism(),/active or pending/);
  await assert.rejects(runtime.createSimulation({world:host,position:[8,0,0]}),/active or pending/);
  assert.equal(runtime.root.matrix.elements[12],1);first.dispose();
  const next=await runtime.createSimulation({world:host,id:'next',position:[3,0,0]});first.dispose();
  assert.equal(runtime.root.matrix.elements[12],3);next.dispose();assert.equal(runtime.root.matrix.elements[12],0);
 }finally{host.dispose();}
});
