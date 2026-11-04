import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Group,Vector3} from 'three';
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


test('standalone simulation preserves stage-local frames beneath a centimetre Z-up glTF root',async()=>{
 const source={...snapshot,metersPerUnit:.01,upAxis:'Z',scenes:[{path:'/Scene',gravityDirection:[0,0,-1],gravityMagnitude:0}],bodies:[{path:'/Body',position:[0,0,100],rotation:q,mass:2,linearVelocity:[0,0,100]}]};
 const extension=createSimreadyExtension({snapshot:source,stageNode:0,bindings:[{node:1,path:'/Body'}]});
 const loaded=await registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{children:[1],translation:[10,2,3],rotation:[-Math.SQRT1_2,0,0,Math.SQRT1_2],scale:[.01,.01,.01]},{translation:[0,0,100]}],extensionsUsed:['NEEDLE_simready'],extensionsRequired:['NEEDLE_simready'],extensions:{NEEDLE_simready:extension}}),'');
 const runtime=loaded.userData.simready,original=runtime.root.matrix.clone();
 const simulation=await runtime.createSimulation({rapier:R});
 try{
  simulation.step(.1);
  const body=simulation.bodies.get('/Body').body.translation();assert.ok(Math.abs(body.z-110)<1e-4);
  const expected=new Vector3(body.x,body.y,body.z).applyMatrix4(runtime.root.matrixWorld);
  const actual=runtime.bindings[0].object.getWorldPosition(new Vector3());
  assert.ok(actual.distanceTo(expected)<1e-5);assert.ok(Math.abs(actual.y-3.1)<1e-5);
 }finally{simulation.dispose();}
 assert.deepEqual(runtime.root.matrix,original);
});
