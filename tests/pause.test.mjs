import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {createSimulation,createSimulationWorld} from '../src/rapier.js';
await R.init();
const q=[0,0,0,1];
const box=(path,position)=>({path,position,rotation:q,mass:1});
const shape=body=>({path:body+'/Shape',body,type:'cube',halfExtents:[.5,.5,.5],position:[0,0,0],rotation:q});
const fixture=()=>({metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',bodies:[box('/Body',[0,3,0])],shapes:[shape('/Body')],joints:[],scenes:[],materials:[],groups:[],unsupported:[]});
const pose=body=>({position:{...body.translation()},rotation:{...body.rotation()}});
const close=(a,b,tolerance=1e-6)=>{for(const key of Object.keys(a))assert.ok(Math.abs(a[key]-b[key])<tolerance,`${key}: ${a[key]} != ${b[key]}`);};
function hybrid(){
 const source=fixture();source.bodies=[box('/Root',[0,3,0]),box('/Link',[1,3,0]),box('/Tip',[2,3,0])];source.shapes=source.bodies.map(b=>shape(b.path));
 source.joints=[{path:'/Fixed',type:'fixed',body0:'/Root',body1:'/Link',position0:[1,0,0],position1:[0,0,0],rotation0:q,rotation1:q},
 {path:'/Hinge',type:'revolute',body0:'/Link',body1:'/Tip',axis:'Z',position0:[.5,0,0],position1:[-.5,0,0],rotation0:q,rotation1:q,drive:{enabled:true,targetPosition:20,targetVelocity:0,stiffness:20,damping:5,forceLimit:10}}];
 source.articulations=[{path:'/Rig',rootPrims:['/Root'],articulatedBodies:source.bodies.map(b=>b.path),articulatedJoints:source.joints.map(j=>j.path),filteredCollisions:[]}];return source;
}
for(const borrowed of [false,true])test(`pause holds hybrid asset while other ${borrowed?'borrowed':'owned'} world assets move and contact it`,async()=>{
 const raw=borrowed?new R.World({x:0,y:-9.81,z:0}):null,events=borrowed?new R.EventQueue(true):null;
 const host=createSimulationWorld({rapier:R,...raw&&{world:raw}}),world=host.world;
 const step=()=>{if(raw){raw.step(events,host.hooks);host.sync();}else host.step();};
 try{
  const asset=await host.addAsset({snapshot:hybrid()}),other=await host.addAsset({snapshot:fixture(),position:[0,3,0]});
  assert.equal(asset.isPlaying(),false,'attachment preserves the existing playback-intent default');
  const root=asset.bodies.get('/Root').body;step();assert.ok(root.translation().y<3,'newly attached assets participate immediately');
  asset.play();for(let i=0;i<10;i++)step();
  const before=new Map([...asset.bodies].map(([path,{body}])=>[path,{pose:pose(body),type:body.bodyType(),linear:{...body.linvel()},angular:{...body.angvel()}}]));
  const jointHandles=[...asset.joints.values()].map(j=>j.handle);
  asset.pause();asset.pause();assert.equal(asset.isPlaying(),false);
  for(let i=0;i<120;i++)step();
  for(const [path,{body}] of asset.bodies){close(body.translation(),before.get(path).pose.position);close(body.rotation(),before.get(path).pose.rotation);assert.equal(body.isEnabled(),true);}
  assert.equal(world.multibodyJoints.len(),1);assert.equal(world.impulseJoints.len(),1);assert.deepEqual([...asset.joints.values()].map(j=>j.handle),jointHandles);
  const falling=other.bodies.get('/Body').body;assert.ok(falling.translation().y<6);assert.ok(Math.abs(falling.translation().y-root.translation().y-1)<.03,'another asset rests on the paused collider');
  asset.play();asset.play();
  for(const [path,{body}] of asset.bodies){const state=before.get(path);assert.equal(body.bodyType(),state.type);close(body.linvel(),state.linear);close(body.angvel(),state.angular);}
  step();assert.ok(root.translation().y<before.get('/Root').pose.position.y);
  for(let cycle=0;cycle<3;cycle++){asset.pause();asset.reset();for(let i=0;i<10;i++)step();close(root.translation(),{x:0,y:3,z:0});asset.play();step();}
  asset.pause();asset.dispose();assert.equal(world.multibodyJoints.len(),0);assert.equal(world.impulseJoints.len(),0);assert.equal(falling.isValid(),true);
 }finally{host.dispose();events?.free();raw?.free();}
});
test('pause restores enabled, sleeping, velocity and pending kinematic target states',async()=>{
 const host=createSimulationWorld({rapier:R});
 try{
  const source=fixture();source.bodies.push({...box('/Sleep',[4,3,0]),startsAsleep:true},{...box('/Disabled',[8,3,0])},{...box('/Kinematic',[12,3,0]),kinematicBody:true});source.shapes=source.bodies.map(b=>shape(b.path));
  const asset=await host.addAsset({snapshot:source}),sleep=asset.bodies.get('/Sleep').body,disabled=asset.bodies.get('/Disabled').body,kinematic=asset.bodies.get('/Kinematic').body,body=asset.bodies.get('/Body').body;
  disabled.setEnabled(false);body.setLinvel({x:2,y:1,z:3},true);body.setAngvel({x:.1,y:.2,z:.3},true);kinematic.setNextKinematicTranslation({x:14,y:3,z:0});
  asset.pause();for(let i=0;i<10;i++)host.step();close(kinematic.translation(),{x:12,y:3,z:0});asset.play();
  assert.equal(disabled.isEnabled(),false);assert.equal(sleep.isSleeping(),true);assert.equal(kinematic.bodyType(),R.RigidBodyType.KinematicPositionBased);close(kinematic.nextTranslation(),{x:14,y:3,z:0});close(body.linvel(),{x:2,y:1,z:3});close(body.angvel(),{x:.1,y:.2,z:.3});
  host.step();close(kinematic.translation(),{x:14,y:3,z:0});
 }finally{host.dispose();}
});
test('standalone pause stops update while explicit step advances and keeps the asset paused',async()=>{
 const asset=await createSimulation({rapier:R,snapshot:fixture()});
 try{asset.play();asset.update(.05);const body=asset.bodies.get('/Body').body,before=body.translation().y;asset.pause();asset.update(.1);assert.equal(body.translation().y,before);asset.step(.05);assert.ok(body.translation().y<before);assert.equal(asset.isPlaying(),false);const held=body.translation().y;asset.world.step();assert.equal(body.translation().y,held);asset.play();asset.update(.05);assert.ok(body.translation().y<held);asset.reset();asset.update(.05);assert.equal(body.translation().y,3);}finally{asset.dispose();asset.pause();asset.play();asset.dispose();}
});
test('pause preserves fixed subtrees joined through internal links without an invalid multibody merge',async()=>{
 const source=fixture();source.bodies=['/A','/B','/C','/D'].map((path,i)=>box(path,[i,3,0]));source.shapes=source.bodies.map(b=>shape(b.path));
 const fixed=(path,body0,body1,offset)=>({path,type:'fixed',body0,body1,position0:[offset,0,0],position1:[0,0,0],rotation0:q,rotation1:q});
 source.joints=[fixed('/AB','/A','/B',1),fixed('/CD','/C','/D',1),fixed('/DB','/D','/B',-2)];
 source.articulations=[{path:'/Rig',rootPrims:['/C'],articulatedBodies:source.bodies.map(b=>b.path),articulatedJoints:source.joints.map(j=>j.path),filteredCollisions:[]}];
 const host=createSimulationWorld({rapier:R});
 try{const asset=await host.addAsset({snapshot:source});for(let i=0;i<10;i++)host.step();const before=[...asset.bodies.values()].map(({body})=>pose(body));asset.pause();for(let i=0;i<60;i++)host.step();[...asset.bodies.values()].forEach(({body},i)=>{close(body.translation(),before[i].position);close(body.rotation(),before[i].rotation);});asset.play();host.step();assert.ok(asset.bodies.get('/C').body.translation().y<before[2].position.y);assert.equal(host.world.multibodyJoints.len(),2);assert.equal(host.world.impulseJoints.len(),1);assert.ok(asset.backend.adaptations.some(item=>item.path==='/DB'&&item.target==='fixed impulse constraint'));}finally{host.dispose();}
});
test('fixed root-to-internal attachments reverse their frames and retain a freezable multibody root',async()=>{
 const source=fixture();source.bodies=['/A','/B','/C'].map((path,i)=>box(path,[i,3,0]));source.shapes=source.bodies.map(b=>shape(b.path));
 const fixed=(path,body0,body1,offset)=>({path,type:'fixed',body0,body1,position0:[offset,0,0],position1:[0,0,0],rotation0:q,rotation1:q});
 source.joints=[fixed('/AB','/A','/B',1),fixed('/CB','/C','/B',-1)];source.articulations=[{path:'/Rig',rootPrims:['/A'],articulatedBodies:source.bodies.map(b=>b.path),articulatedJoints:source.joints.map(j=>j.path),filteredCollisions:[]}];
 const host=createSimulationWorld({rapier:R});
 try{const asset=await host.addAsset({snapshot:source});for(let i=0;i<10;i++)host.step();const before=[...asset.bodies.values()].map(({body})=>pose(body));asset.pause();for(let i=0;i<60;i++)host.step();[...asset.bodies.values()].forEach(({body},i)=>close(body.translation(),before[i].position));asset.play();host.step();assert.equal(host.world.multibodyJoints.len(),2);assert.equal(host.world.impulseJoints.len(),0);}finally{host.dispose();}
});
