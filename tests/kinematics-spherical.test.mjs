import {test} from 'node:test';import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';import {createMechanism} from '../src/kinematics.js';
const identity=[0,0,0,1];
for(const reversed of [false,true])test(`spherical joints preserve pivots, expose quaternion controls and support pointer dragging (reversed: ${reversed})`,async()=>{
 const snapshot={metersPerUnit:1,bodies:[{path:'/Base',position:[0,0,0],rotation:identity,kinematicBody:true},{path:'/Tip',position:[1,0,0],rotation:identity}],joints:[{path:'/Ball',type:'spherical',body0:reversed?'/Tip':'/Base',body1:reversed?'/Base':'/Tip',position0:reversed?[-1,0,0]:[0,0,0],position1:reversed?[0,0,0]:[-1,0,0]}]};
 const before=structuredClone(snapshot),m=await createMechanism({snapshot});
 try{
  assert.deepEqual(m.unsupported,[]);assert.equal(m.getJointValue('/Ball'),null);
  assert.equal(m.setJointRotation('/Ball',new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2).toArray()),true);
  assert.ok(new Vector3().copy(m.bodies.get('/Tip').body.translation()).distanceTo(new Vector3(0,reversed?-1:1,0))<1e-6);
  assert.ok(new Quaternion(...m.getJointRotation('/Ball')).angleTo(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2))<1e-6);
  m.reset();m.play();assert.equal(m.beginDrag('/Tip',new Vector3(1,0,0)),true);m.moveDrag(new Vector3(0,1,0));m.endDrag();
  assert.ok(new Vector3().copy(m.bodies.get('/Tip').body.translation()).distanceTo(new Vector3(0,1,0))<1e-6);
  assert.equal(m.setJointRotation('/Ball',[NaN,0,0,1]),false);assert.deepEqual(snapshot,before);
  m.reset();assert.ok(new Vector3().copy(m.bodies.get('/Tip').body.translation()).distanceTo(new Vector3(1,0,0))<1e-6);
 }finally{m.dispose();}
});
test('spherical swing limits clamp motion while preserving free twist',async()=>{
 const m=await createMechanism({snapshot:{metersPerUnit:1,bodies:[{path:'/Tip',position:[1,0,0],rotation:identity}],joints:[{path:'/Ball',type:'spherical',body1:'/Tip',position1:[-1,0,0],axis:'X',limit:{enabled:true,lower:20,upper:30}}]}});
 try{
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/2).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.4));
  assert.equal(m.setJointRotation('/Ball',q.toArray()),true);
  const direction=new Vector3(1,0,0).applyQuaternion(new Quaternion(...m.getJointRotation('/Ball')));
  assert.ok(Math.abs(Math.acos(direction.x)-20*Math.PI/180)<1e-6);assert.equal(m.adaptations[0].target,'circular cone limit');
 }finally{m.dispose();}
});
