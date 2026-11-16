import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry} from 'three';
import R from '@dimforge/rapier3d-compat';
import {cookConvexDecomposition} from '../src/rapierDecomposition.js';
import {repairConvexCompound} from '../src/rapierHull.js';
await R.init();

function container(scale,offset){
 const points=[],indices=[];
 for(const [size,position]of [[[4,1,2],[0,-.5,0]],[[1,2,2],[-1.5,1,0]],[[1,2,2],[1.5,1,0]]]){
  const mesh=new BoxGeometry(...size).translate(...position),base=points.length/3;
  points.push(...Array.from(mesh.attributes.position.array,(value,index)=>(value+offset[index%3])*scale));
  indices.push(...Array.from(mesh.index.array,index=>index+base));mesh.dispose();
 }
 return {type:'convexDecomposition',points:new Float32Array(points),indices:new Uint32Array(indices),resolution:64,concavity:.001,maxHulls:128};
}

for(const scale of [.01,1,100])test(`decomposed collision keeps size, local origin and cavity at scale ${scale}`,()=>{
 const offset=[3,-2,4],shape=container(scale,offset),before=structuredClone(shape);
 const descriptor=cookConvexDecomposition(R,shape,'/Container');assert.ok(descriptor);
 repairConvexCompound(R,descriptor,'/Container',[]);descriptor.setMass(1);
 const world=new R.World({x:0,y:0,z:0});world.lengthUnit=scale;
 try{
  const body=world.createRigidBody(R.RigidBodyDesc.dynamic());const collider=world.createCollider(descriptor,body);
  assert.ok(Math.abs(collider.volume()/scale**3-16)<1.5,'decomposition retains the container volume');
  assert.ok(Math.abs(body.localCom().x/scale-offset[0])<.04,'local origin is restored in mass properties');
  assert.ok(Math.abs(body.localCom().z/scale-offset[2])<.04);
  world.step();
  const hit=world.castRay(new R.Ray({x:offset[0]*scale,y:(offset[1]+3)*scale,z:offset[2]*scale},{x:0,y:-1,z:0}),10*scale,true);
  assert.ok(hit);assert.ok(Math.abs(hit.timeOfImpact/scale-3)<.1,'ray reaches the cavity floor, not an enclosing convex hull');
  assert.deepEqual(shape,before,'cooking does not change the source collision mesh');
 }finally{world.free();}
});
