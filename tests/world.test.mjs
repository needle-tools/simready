import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {createSimulation,createSimulationWorld} from '../src/rapier.js';
import {createMechanism} from '../src/kinematics.js';
import {transformSnapshot} from '../src/transform.js';

await R.init();
const q=[0,0,0,1];
const fixture=({metersPerUnit=1,kilogramsPerUnit=1,upAxis='Y',height=3}={})=>({
 metersPerUnit,kilogramsPerUnit,upAxis,scenes:[],
 bodies:[{path:'/Body',position:upAxis==='Z'?[0,0,height]:[0,height,0],rotation:q,scale:[1,1,1],mass:2,rigidBodyEnabled:true}],
 shapes:[{path:'/Body/Shape',body:'/Body',type:'cube',halfExtents:[.5,.5,.5],position:[0,0,0],rotation:q}],
 joints:[],materials:[],groups:[],unsupported:[],
});
const floor=()=>({...fixture(),bodies:[],shapes:[{path:'/Floor',type:'cube',body:'',halfExtents:[10,.5,10],position:[0,-.5,0],rotation:q}]});

test('headless assets collide across imports and removal leaves the host world intact',async()=>{
 assert.equal(globalThis.document,undefined);assert.equal(globalThis.window,undefined);
 const host=createSimulationWorld({rapier:R});
 try{
  await host.addAsset({id:'floor',snapshot:floor()});
  const a=await host.addAsset({id:'first',snapshot:fixture()});
  const b=await host.addAsset({id:'second',snapshot:fixture(),position:[0,3,0]});
  for(let i=0;i<360;i++)host.step();
  assert.ok(Math.abs(a.bodies.get('/Body').body.translation().y-.5)<.03);
  assert.ok(Math.abs(b.bodies.get('/Body').body.translation().y-1.5)<.04,'second import rests on first import');
  assert.notEqual(a.bodies.get('/Body').body.handle,b.bodies.get('/Body').body.handle);
  const source=JSON.stringify(fixture());
  assert.equal(host.removeAsset('first'),true);assert.equal(host.removeAsset('missing'),false);
  for(let i=0;i<240;i++)host.step();
  assert.ok(Math.abs(b.bodies.get('/Body').body.translation().y-.5)<.03,'remaining import falls onto independent floor');
  assert.equal(host.assets.size,2);assert.equal(JSON.stringify(fixture()),source);
  assert.throws(()=>b.step(),/owning simulation world/);
 }finally{host.dispose();host.dispose();}
});

test('centimetre Z-up assets compose with metre Y-up assets, with physical inertia and drives',async()=>{
 const source=fixture({metersPerUnit:.01,kilogramsPerUnit:.001,upAxis:'Z',height:300});
 source.bodies[0].mass=2000;source.bodies[0].diagonalInertia=[1000000,2000000,3000000];
 source.shapes[0].halfExtents=[50,50,50];
 const before=structuredClone(source),host=createSimulationWorld({rapier:R});
 try{
  await host.addAsset({snapshot:floor()});
  const asset=await host.addAsset({snapshot:source});
  const body=asset.bodies.get('/Body').body;
  assert.ok(Math.abs(body.mass()-2)<1e-6);assert.deepEqual(asset.snapshot.bodies[0].diagonalInertia,[.1,.2,.3]);
  assert.ok(Math.abs(body.translation().y-3)<1e-6);
  for(let i=0;i<240;i++)host.step();
  assert.ok(Math.abs(body.translation().y-.5)<.03);assert.deepEqual(source,before);
  asset.reset();assert.ok(Math.abs(body.translation().y-3)<1e-6);
 }finally{host.dispose();}
 const d=fixture({metersPerUnit:.01,kilogramsPerUnit:.001});
 d.joints=[{path:'/Slide',type:'prismatic',body0:'',body1:'/Body',position0:[0,0,0],position1:[0,0,0],rotation0:q,rotation1:q,axis:'X',limit:{enabled:true,lower:0,upper:100},drive:{enabled:true,targetPosition:50,targetVelocity:10,stiffness:1000,damping:100,forceLimit:10000},breakForce:100,breakTorque:100}];
 const joint=transformSnapshot(d).joints[0];
 assert.equal(joint.limit.upper,1);assert.equal(joint.drive.targetPosition,.5);assert.equal(joint.drive.forceLimit,.1);
 assert.equal(joint.breakForce,.001);assert.equal(joint.breakTorque,.00001);
});

test('failed strict attachments roll back only their resources; duplicate ids do not race',async()=>{
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]});
 try{
  const a=await host.addAsset({snapshot:fixture(),id:'first'}),count=host.world.bodies.len();
  const bad=fixture();bad.joints=[{path:'/Bad',type:'not-a-joint',body0:'',body1:'/Body'}];
  await assert.rejects(host.addAsset({snapshot:bad,id:'bad'}),/Simulation unavailable/);
  assert.equal(host.world.bodies.len(),count);assert.equal(host.assets.size,1);
  await assert.rejects(host.addAsset({snapshot:fixture(),id:'first'}),/Duplicate/);
  const pending=host.addAsset({snapshot:fixture(),id:'pending'});
  await assert.rejects(host.addAsset({snapshot:fixture(),id:'pending'}),/Duplicate/);
  await pending;host.step();assert.equal(a.bodies.get('/Body').body.translation().y,3);
 }finally{host.dispose();}
});

test('host step advances exactly the requested duration without playback or wall-clock clamping',async()=>{
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]});
 try{
  const f=fixture();f.bodies[0].linearVelocity=[2,0,0];
  const asset=await host.addAsset({snapshot:f});host.step(.25);
  assert.ok(Math.abs(asset.bodies.get('/Body').body.translation().x-.5)<1e-5);
  assert.throws(()=>host.step(0),/positive/);assert.throws(()=>host.step(NaN),/positive/);
 }finally{host.dispose();}
 const f=fixture();f.scenes=[{path:'/Zero',gravityDirection:[0,-1,0],gravityMagnitude:0}];f.bodies[0].linearVelocity=[2,0,0];
 const simulation=await createSimulation({snapshot:f,rapier:R});
 try{simulation.step(.25);assert.ok(Math.abs(simulation.bodies.get('/Body').body.translation().x-.5)<1e-5);}finally{simulation.dispose();}
});

test('disposing while a visual binding is pending does not touch a freed Rapier world',async()=>{
 const host=createSimulationWorld({rapier:R});let finish;
 const loading=host.addAsset({snapshot:fixture(),bindVisuals:()=>new Promise(resolve=>{finish=()=>resolve({sync(){},reset(){},bodyForObject(){return null;}});})});
 host.dispose();finish();await assert.rejects(loading,/disposed/);assert.equal(host.assets.size,0);
 assert.throws(()=>host.step(),/disposed/);
});

test('kinematics works headlessly and keeps authored records unchanged',async()=>{
 const f=fixture();f.bodies[0].position=[0,0,0];f.joints=[{path:'/Slide',type:'prismatic',axis:'X',body0:'',body1:'/Body',position0:[0,0,0],position1:[0,0,0],rotation0:q,rotation1:q,limit:{enabled:true,lower:0,upper:2}}];
 const before=structuredClone(f),mechanism=await createMechanism({snapshot:f});
 try{assert.equal(mechanism.setJointValue('/Slide',5),true);assert.ok(Math.abs(mechanism.getJointValue('/Slide')-2)<1e-5);assert.deepEqual(f,before);}finally{mechanism.dispose();}
});

test('stale disposed handles cannot detach a replacement with the same id',async()=>{
 const host=createSimulationWorld({rapier:R});
 try{
  const first=await host.addAsset({snapshot:fixture(),id:'part'});first.dispose();
  const replacement=await host.addAsset({snapshot:fixture(),id:'part'});first.dispose();
  assert.equal(host.assets.get('part'),replacement);assert.equal(host.world.bodies.len(),2);
  host.removeAsset('part');assert.equal(host.world.bodies.len(),0);
 }finally{host.dispose();}
});

test('strict mode reports dangling collider identities and rolls back warnings from visual bindings',async()=>{
 const host=createSimulationWorld({rapier:R});
 try{
  const broken=fixture();broken.shapes[0].body='/Missing';
  await assert.rejects(host.addAsset({snapshot:broken}),/Collider owner references unavailable/);
  assert.equal(host.world.bodies.len(),0);
  const partial=await host.addAsset({snapshot:broken,allowPartial:true});
  assert.ok(partial.unsupported.some(issue=>issue.reason.includes('/Missing')));partial.dispose();
  let reset=0;
  await assert.rejects(host.addAsset({snapshot:fixture(),bindVisuals:(_bodies,warn)=>{
   warn({path:'/Visual'},'The instance is not bound.');return {sync(){},reset(){reset++;},bodyForObject(){return null;}};
  }}),/instance is not bound/);
  assert.equal(reset,1);assert.equal(host.world.bodies.len(),0);assert.equal(host.assets.size,0);
 }finally{host.dispose();}
});

test('throwing visual cleanup cannot strand other assets or leak world ownership',async()=>{
 const host=createSimulationWorld({rapier:R});let resets=0;
 const broken=await host.addAsset({snapshot:fixture(),id:'broken',bindVisuals:()=>({sync(){},reset(){throw new Error('reset failed');},bodyForObject(){return null;}})});
 const healthy=await host.addAsset({snapshot:fixture(),id:'healthy',bindVisuals:()=>({sync(){},reset(){resets++;},bodyForObject(){return null;}})});
 assert.throws(()=>broken.dispose(),/reset failed/);assert.equal(host.assets.size,1);assert.equal(host.world.bodies.len(),2);
 broken.dispose();assert.equal(host.assets.get('healthy'),healthy);
 const another=await host.addAsset({snapshot:fixture(),id:'another',bindVisuals:()=>({sync(){},reset(){throw new Error('another failed');},bodyForObject(){return null;}})});
 assert.throws(()=>host.dispose(),AggregateError);assert.equal(resets,1);assert.equal(host.assets.size,0);host.dispose();another.dispose();
});

test('a pending asset stays inactive while the host continues stepping existing assets',async()=>{
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]});let finish,pendingBody;
 try{
  const f=fixture();f.bodies[0].linearVelocity=[2,0,0];
  const active=await host.addAsset({snapshot:f});
  const pending=host.addAsset({snapshot:f,position:[0,0,3],bindVisuals:bodies=>new Promise(resolve=>{pendingBody=bodies.get('/Body').body;finish=()=>resolve({sync(){},reset(){},bodyForObject(){return null;}});})});
  host.step(.25);
  assert.ok(Math.abs(active.bodies.get('/Body').body.translation().x-.5)<1e-5);
  assert.equal(pendingBody.translation().x,0);assert.equal(pendingBody.isEnabled(),false);
  finish();await pending;assert.equal(pendingBody.isEnabled(),true);
  host.step(.25);assert.ok(Math.abs(pendingBody.translation().x-.5)<1e-5);
 }finally{host.dispose();}
});

test('strict unsupported assets reject before reading or copying collision buffers',async()=>{
 const source=fixture();let reads=0;source.shapes[0].type='mesh';source.shapes[0].approximation='sdf';
 Object.defineProperty(source.shapes[0],'points',{enumerable:true,get(){reads++;return new Float32Array(12);}});
 const host=createSimulationWorld({rapier:R});
 try{
  await assert.rejects(host.addAsset({snapshot:source}),/sdf/);assert.equal(reads,0);assert.equal(host.world.bodies.len(),0);
  await assert.rejects(createSimulation({snapshot:source,rapier:R}),/sdf/);assert.equal(reads,0);
 }finally{host.dispose();}
});
