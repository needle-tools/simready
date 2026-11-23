import assert from 'node:assert/strict';
import {test} from 'node:test';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSimreadyRuntimeExtension} from '../src/index.js';
import {NeedleSimreadyLoaderPlugin,registerSimreadyLoader,getSimreadyRuntime,toGltfPhysicsSnapshot,fromGltfPhysicsSnapshot} from '../src/gltf.js';
const source=()=>({bodies:[{path:'/Body',position:[0,1,0],rotation:[0,0,0,1],mass:2,gravityScale:0,continuousCollision:false,physx:{vendor:'do not archive'},attributes:[{name:'xformOp:transform',value:[]}]}],shapes:[],joints:[],groups:[],materials:[],scenes:[],unsupported:[]});
const options=()=>({snapshot:source(),stageNode:0,bindings:[{node:1,path:'/Body',instance:{rawUsd:'forbidden'}}],semantics:[{path:'/Body',taxonomy:'class',labels:['cabinet']}]});
const asset=payload=>({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{children:[1]},{}],extensionsUsed:['NEEDLE_simready'],extensionsRequired:['NEEDLE_simready'],extensions:{NEEDLE_simready:payload}});
const load=payload=>registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(asset(payload)),'');
test('runtime export has a closed vocabulary and drops source property bags',async()=>{
 const data=createSimreadyRuntimeExtension(options());
 assert.equal(data.version,1);
 assert.equal(data.snapshot.bodies[0].physx,undefined);assert.equal(data.snapshot.bodies[0].attributes,undefined);assert.equal(data.bindings[0].instance,undefined);
 assert.equal(data.snapshot.bodies[0].mass,2);assert.equal(data.snapshot.bodies[0].gravityScale,0);assert.equal(data.snapshot.bodies[0].continuousCollision,false);
 const loaded=await load(data),runtime=getSimreadyRuntime(loaded);
 assert.deepEqual(runtime.semantics,data.semantics);assert.deepEqual(loaded.scene.children[0].children[0].userData.simreadyLabels,[{taxonomy:'class',labels:['cabinet']}]);
 const mechanism=await runtime.createMechanism();try{assert.equal(mechanism.bodies.size,1);}finally{mechanism.dispose();}
});

test('runtime export omits optional defaults and keeps authored physics overrides', async () => {
 const snapshot = {
  bodies: [
   {path: '/Body', position: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1],
    rigidBodyEnabled: true, kinematicBody: false, startsAsleep: false, gravityScale: 1, continuousCollision: false},
  ],
  shapes: [{path: '/Collider', body: '/Body', type: 'cylinder', radius: 1, halfHeight: 1,
   position: [0, 0, 0], rotation: [0, 0, 0, 1], collisionEnabled: true, axis: 'X'}],
  joints: [{path: '/Hinge', type: 'revolute', body1: '/Body', position0: [0, 0, 0], position1: [0, 0, 0],
   rotation0: [0, 0, 0, 1], rotation1: [0, 0, 0, 1], jointEnabled: true,
   collisionEnabled: false, excludeFromArticulation: false, axis: 'X',
   drive: {enabled: true, targetPosition: 0, targetVelocity: 0, stiffness: 1, damping: 1, acceleration: false}}],
  groups: [{path: '/Group', invertFilteredGroups: false}], materials: [], scenes: [],
 };
 const authored = structuredClone(snapshot);
 const sparse = createSimreadyRuntimeExtension({...options(), snapshot});
 assert.deepEqual(sparse.snapshot, {
  bodies: [{path: '/Body', position: [0, 0, 0], rotation: [0, 0, 0, 1], gravityScale: 1, continuousCollision: false}],
  shapes: [{path: '/Collider', body: '/Body', type: 'cylinder', radius: 1, halfHeight: 1}],
  joints: [{path: '/Hinge', type: 'revolute', body1: '/Body',
   drive: {enabled: true, targetPosition: 0, targetVelocity: 0, stiffness: 1, damping: 1}}],
  groups: [{path: '/Group'}], materials: [], scenes: [],
 });
 assert.deepEqual(snapshot, authored);

 const poses = [];
 for (const payload of [sparse, {...sparse, snapshot: authored}]) {
  const runtime = getSimreadyRuntime(await load(payload));
  const mechanism = await runtime.createMechanism();
  try {
   assert.equal(mechanism.setJointValue('/Hinge', 45), true);
   assert.ok(Math.abs(mechanism.getJointValue('/Hinge') - 45) < 1e-5);
   poses.push({...mechanism.bodies.get('/Body').body.rotation()});
  } finally {
   mechanism.dispose();
  }
 }
 assert.deepEqual(poses[0], poses[1]);

 snapshot.bodies[0].scale = [1, 1, 1.000001];
 snapshot.shapes[0].collisionEnabled = false;
 snapshot.joints[0].axis = 'Y';
 snapshot.joints[0].drive.acceleration = true;
 snapshot.groups[0].invertFilteredGroups = true;
 const overrides = createSimreadyRuntimeExtension({...options(), snapshot}).snapshot;
 assert.deepEqual(overrides.bodies[0].scale, snapshot.bodies[0].scale);
 assert.equal(overrides.shapes[0].collisionEnabled, false);
 assert.equal(overrides.joints[0].axis, 'Y');
 assert.equal(overrides.joints[0].drive.acceleration, true);
 assert.equal(overrides.groups[0].invertFilteredGroups, true);
});

test('runtime import validates the closed descriptor fields',async()=>{
 for(const edit of [p=>p.version=3,p=>p.unknownField={},p=>p.snapshot.unknownField=[],p=>p.snapshot.bodies[0].physxProperties={},p=>p.bindings[0].instance={source:'USD'},p=>p.semantics[0].attributes=[],p=>p.semantics[0].path='/Missing']){
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

test('optional incompatible metadata leaves the rendered scene usable', async t=>{
 const warning=t.mock.method(console,'warn',()=>{});
 const input=asset({version:99});
 delete input.extensionsRequired;
 input.nodes[1].name='Door';
 const loader=registerSimreadyLoader(new GLTFLoader());
 const result=await loader.parseAsync(JSON.stringify(input),'');
 assert.ok(result.scene.getObjectByName('Door'));
 assert.equal(getSimreadyRuntime(result),null);
 assert.match(warning.mock.calls[0].arguments[0],/optional.*version 99/i);
 input.extensionsRequired=['NEEDLE_simready'];
 await assert.rejects(loader.parseAsync(JSON.stringify(input),''),/Invalid SimReady runtime payload/);
});

test('an invalid optional binding leaves no partially applied runtime identities', async t=>{
 t.mock.method(console,'warn',()=>{});
 const input=asset(createSimreadyRuntimeExtension(options()));
 delete input.extensionsRequired;
 input.extensions.NEEDLE_simready.bindings.push({node:99,path:'/Absent'});
 const result=await registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(input),'');
 assert.equal(getSimreadyRuntime(result),null);
 assert.equal(result.scene.children[0].children[0].userData.usdSourcePath,undefined);
});

test('optional metadata propagates failures loading a valid dependency', async ()=>{
 const json=asset(createSimreadyRuntimeExtension(options()));
 delete json.extensionsRequired;
 const failure=new Error('Could not read node dependency');
 const plugin=new NeedleSimreadyLoaderPlugin({json,getDependency:async()=>{throw failure;}});
 await assert.rejects(plugin.afterRoot({}),error=>error===failure);
});
