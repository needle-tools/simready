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
