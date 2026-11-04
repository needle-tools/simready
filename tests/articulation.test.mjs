import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '../src/rapier.js';
await R.init();
const q=[0,0,0,1];
function fixture(){return {metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],unsupported:[],
 bodies:[{path:'/Base',position:[0,0,0],rotation:q,rigidBodyEnabled:false},{path:'/Slide',position:[0,0,0],rotation:q,mass:1},{path:'/Other',position:[0,0,0],rotation:q,mass:1}],
 shapes:[{path:'/Slide/Collider',body:'/Slide',type:'cube',halfExtents:[.1,.1,.1],position:[0,0,0],rotation:q},{path:'/Other/Collider',body:'/Other',type:'cube',halfExtents:[.1,.1,.1],position:[0,0,0],rotation:q}],
 joints:[{path:'/SlideJoint',type:'prismatic',body0:'/Base',body1:'/Slide',axis:'X',position0:[0,0,0],position1:[0,0,0],rotation0:q,rotation1:q,limit:{enabled:true,lower:0,upper:1},drive:{enabled:true,targetPosition:.6,targetVelocity:0,stiffness:100,damping:20,forceLimit:10}}],
 articulations:[{path:'/Rig',rootPrims:['/Base'],articulatedBodies:['/Base','/Slide'],articulatedJoints:['/SlideJoint'],filteredCollisions:['/OtherRig']},{path:'/OtherRig',rootPrims:['/Other'],articulatedBodies:['/Other'],articulatedJoints:[],filteredCollisions:[]}],
};}
test('articulation membership retains drives and limits while filters resolve non-descendant member bodies',async()=>{
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]}),source=fixture(),before=structuredClone(source);
 try{
  const asset=await host.addAsset({snapshot:source}),a=asset.bodies.get('/Slide').colliders[0],b=asset.bodies.get('/Other').colliders[0];
  assert.equal(host.hooks.filterContactPair(a.handle,b.handle),null);
  for(let i=0;i<360;i++)host.step();assert.ok(Math.abs(asset.getJointValue('/SlideJoint')-.6)<.01);
  assert.equal(asset.setJointTarget('/SlideJoint',{position:2}),true);
  for(let i=0;i<240;i++)host.step();assert.ok(Math.abs(asset.getJointValue('/SlideJoint')-1)<.01);
  assert.equal(asset.backend.jointSolver,'impulse');assert.equal(asset.backend.adaptations[0].source,'reduced-coordinate articulation');
  assert.deepEqual(asset.unsupported,[]);assert.deepEqual(source,before);
 }finally{host.dispose();}
});
test('broken articulation references and invalid native descriptors still fail strict simulation',async()=>{
 const host=createSimulationWorld({rapier:R});
 try{
  const missing=fixture();missing.articulations[0].articulatedBodies.push('/Missing');
  await assert.rejects(host.addAsset({snapshot:missing}),/Articulation body references unavailable/);
  const disconnected=fixture();disconnected.articulations[0].articulatedBodies=['/Base'];
  await assert.rejects(host.addAsset({snapshot:disconnected}),/Articulation joint body references unavailable/);
  const invalid=fixture();invalid.unsupported=[{path:'/Invalid',type:'Articulation',reason:'Invalid OpenUSD articulation descriptor'}];
  await assert.rejects(host.addAsset({snapshot:invalid}),/Invalid OpenUSD articulation/);assert.equal(host.world.bodies.len(),0);
 }finally{host.dispose();}
});

test('reduced-coordinate fixed links stabilize extreme articulation masses in a borrowed world',async()=>{
 const world=new R.World({x:0,y:-9.81,z:0});world.numSolverIterations=4;
 const host=createSimulationWorld({rapier:R,world}),events=new R.EventQueue(true);
 const fixed=(path,body0,body1)=>({path,type:'fixed',body0,body1,position0:[0,0,0],position1:[0,0,0],rotation0:q,rotation1:q});
 const source={...fixture(),bodies:[{path:'/Base',position:[0,0,0],rotation:q,mass:80,diagonalInertia:[3,3,5]},
  {path:'/Bridge',position:[0,0,0],rotation:q,mass:.001,diagonalInertia:[.000001,.000001,.000001]},
  {path:'/Load',position:[1,0,0],rotation:q,mass:4,diagonalInertia:[.01,.01,.01]}],
  shapes:[],joints:[fixed('/World','', '/Base'),fixed('/Fixed','/Base','/Bridge'),{path:'/Hinge',type:'revolute',body0:'/Bridge',body1:'/Load',axis:'Z',position0:[0,0,0],position1:[-1,0,0],rotation0:q,rotation1:q,limit:{enabled:true,lower:-30,upper:30},drive:{enabled:true,targetPosition:0,targetVelocity:0,stiffness:100,damping:10,forceLimit:100}}],
  articulations:[{path:'/Rig',rootPrims:['/Base'],articulatedBodies:['','/Base','/Bridge','/Load'],articulatedJoints:['/World','/Fixed','/Hinge'],filteredCollisions:[]}]};
 const before=structuredClone(source);
 try{
  const asset=await host.addAsset({snapshot:source}),bridge=asset.bodies.get('/Bridge').body,load=asset.bodies.get('/Load').body;
  assert.equal(asset.backend.jointSolver,'hybrid');assert.equal(world.multibodyJoints.len(),2);assert.equal(world.impulseJoints.len(),1);
  for(let i=0;i<240;i++){world.step(events,host.hooks);host.sync();}
  assert.ok(Math.hypot(bridge.translation().x,bridge.translation().y,bridge.translation().z)<.001,'tiny fixed intermediate remains welded to the fixed root');
  const joint=asset.joints.get('/Hinge');assert.ok(Math.abs(asset.getJointValue('/Hinge'))<30.2);
  assert.equal(bridge.mass(),Math.fround(.001));assert.equal(world.numSolverIterations,4);
  asset.reset();assert.equal(load.translation().x,1);assert.equal(load.translation().y,0);
  world.step(events,host.hooks);assert.equal(joint.isValid(),true);
  assert.deepEqual(source,before);asset.dispose();assert.equal(world.multibodyJoints.len(),0);assert.equal(world.impulseJoints.len(),0);assert.equal(world.bodies.len(),0);
 }finally{host.dispose();events.free();world.free();}
});

test('closed fixed articulation loops keep a valid constraint forest and dispose both joint kinds',async()=>{
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]});
 const source=fixture();source.shapes=[];source.bodies=source.bodies.slice(0,2);
 const fixed=path=>({path,type:'fixed',body0:'/Base',body1:'/Slide',position0:[0,0,0],position1:[0,0,0],rotation0:q,rotation1:q});
 source.joints=[fixed('/First'),fixed('/Loop')];source.articulations=[{path:'/Rig',rootPrims:['/Base'],articulatedBodies:['/Base','/Slide'],articulatedJoints:['/First','/Loop'],filteredCollisions:[]}];
 try{const asset=await host.addAsset({snapshot:source});host.step();assert.equal(host.world.multibodyJoints.len(),1);assert.equal(host.world.impulseJoints.len(),1);asset.dispose();assert.equal(host.world.multibodyJoints.len(),0);assert.equal(host.world.impulseJoints.len(),0);}finally{host.dispose();}
});
