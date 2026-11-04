import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BoxGeometry} from 'three';
import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '../src/rapier.js';
await R.init();
const q=[0,0,0,1],empty={metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',bodies:[],shapes:[],joints:[],materials:[],groups:[],scenes:[],unsupported:[]};
function concaveMesh(){
 const points=[],indices=[];
 for(const [size,position] of [[[4,1,2],[0,-.5,0]],[[1,2,2],[-1.5,1,0]],[[1,2,2],[1.5,1,0]]]){
  const geometry=new BoxGeometry(...size).translate(...position),offset=points.length/3;
  points.push(...geometry.attributes.position.array);indices.push(...Array.from(geometry.index.array,index=>index+offset));geometry.dispose();
 }
 return {points,indices};
}
test('SDF-source dynamic concave meshes preserve cavities and collide with independently imported objects',async()=>{
 const host=createSimulationWorld({rapier:R});
 try{
  await host.addAsset({snapshot:{...empty,shapes:[{path:'/Ground',type:'cube',halfExtents:[10,.5,10],position:[0,-.5,0],rotation:q}]}});
  const source={...empty,bodies:[{path:'/Container',position:[0,1,0],rotation:q,mass:20}],shapes:[{path:'/Mesh',body:'/Container',type:'mesh',approximation:'sdf',...concaveMesh(),position:[0,0,0],rotation:q}]};
  const before=structuredClone(source),container=await host.addAsset({snapshot:source});
  const object=await host.addAsset({snapshot:{...empty,bodies:[{path:'/Ball',position:[0,5,0],rotation:q,mass:.2}],shapes:[{path:'/BallShape',body:'/Ball',type:'sphere',radius:.2,position:[0,0,0],rotation:q}]}});
  for(let i=0;i<480;i++)host.step();
  const base=container.bodies.get('/Container').body.translation(),ball=object.bodies.get('/Ball').body.translation();
  assert.ok(Math.abs(base.y-1)<.03);assert.ok(Math.abs(ball.y-base.y-.2)<.04,'ball rests inside cavity rather than on a convex hull');
  assert.deepEqual(container.unsupported,[]);assert.equal(container.backend.adaptations[0].target,'convex decomposition');assert.deepEqual(source,before);
 }finally{host.dispose();}
});
test('collider-local mass, COM and principal moments aggregate into the body without body overrides',async()=>{
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]});
 try{
  const asset=await host.addAsset({snapshot:{...empty,bodies:[{path:'/Body',position:[0,0,0],rotation:q}],shapes:[{path:'/Shape',body:'/Body',type:'cube',halfExtents:[1,1,1],position:[2,0,0],rotation:q,mass:5,centerOfMass:[.25,.5,0],diagonalInertia:[2,3,4],principalAxes:q}]}});
  const body=asset.bodies.get('/Body').body;
  assert.equal(body.mass(),5);assert.deepEqual({...body.localCom()},{x:2.25,y:.5,z:0});assert.deepEqual({...body.principalInertia()},{x:2,y:3,z:4});assert.deepEqual(asset.unsupported,[]);
 }finally{host.dispose();}
});
test('collider COM-only overrides retain mass and shift derived inertia, while body properties take precedence',async()=>{
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]});
 try{
  const source={...empty,bodies:[{path:'/Body',position:[0,0,0],rotation:q}],shapes:[{path:'/Shape',body:'/Body',type:'cube',halfExtents:[1,1,1],position:[0,0,0],rotation:q,mass:6,centerOfMass:[1,0,0]}]};
  const asset=await host.addAsset({snapshot:source}),body=asset.bodies.get('/Body').body;
  assert.equal(body.mass(),6);assert.deepEqual({...body.localCom()},{x:1,y:0,z:0});assert.deepEqual({...body.principalInertia()},{x:4,y:10,z:10});
  const overriding=structuredClone(source);Object.assign(overriding.bodies[0],{mass:8,centerOfMass:[0,0,0],diagonalInertia:[3,4,5],principalAxes:q});
  const second=await host.addAsset({snapshot:overriding,position:[0,0,5]}),other=second.bodies.get('/Body').body;
  assert.equal(other.mass(),8);assert.deepEqual({...other.localCom()},{x:0,y:0,z:0});assert.deepEqual({...other.principalInertia()},{x:3,y:4,z:5});
 }finally{host.dispose();}
});
