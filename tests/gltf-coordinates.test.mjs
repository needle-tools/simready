import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Quaternion,Vector3} from 'three';
import R from '@dimforge/rapier3d-compat';
import {toGltfPhysicsSnapshot,fromGltfPhysicsSnapshot} from '../src/gltf.js';
import {transformSnapshot} from '../src/transform.js';
import {createSimulation} from '../src/rapier.js';

const identity=[0,0,0,1],radians=Math.PI/180;
const empty=()=>({metersPerUnit:.01,kilogramsPerUnit:.001,upAxis:'Z',bodies:[],shapes:[],joints:[],scenes:[],materials:[],groups:[]});
function close(actual,expected,tolerance=1e-10){
 assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
}
function vector(actual,expected,tolerance){assert.equal(actual.length,expected.length);actual.forEach((value,index)=>close(value,expected[index],tolerance));}
const rotate=(point,rotation)=>new Vector3(...point).applyQuaternion(new Quaternion(...rotation)).toArray();
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}

function spatialFixture(){
 return {...empty(),
  bodies:[{path:'/Body',position:[100,200,300],rotation:identity,linearVelocity:[10,20,30],angularVelocity:[90,180,270],mass:1000,density:1,centerOfMass:[10,20,30],diagonalInertia:[10000,20000,30000],principalAxes:[0,0,Math.SQRT1_2,Math.SQRT1_2],scale:[2,3,4]}],
  shapes:[
   {path:'/Box',body:'/Body',type:'cube',position:[10,20,30],rotation:[0,0,Math.SQRT1_2,Math.SQRT1_2],halfExtents:[20,30,40],mass:500,density:2,centerOfMass:[1,2,3],diagonalInertia:[100,200,300],principalAxes:identity},
   {path:'/Plane',type:'plane',axis:'Z',position:[100,200,300],rotation:identity},
   {path:'/Mesh',type:'mesh',position:[100,200,300],rotation:identity,points:[0,0,0,100,0,0,0,100,0],indices:[0,1,2],meshScale:[2,3,4]},
   {path:'/OwnedMesh',body:'/Body',type:'mesh',position:[10,20,30],rotation:identity,points:[0,0,0,100,0,0,0,100,0],indices:[0,1,2],meshScale:[2,3,4]},
  ],
  joints:[{path:'/Joint',type:'revolute',body0:'',body1:'/Body',position0:[100,200,300],position1:[10,20,30],rotation0:identity,rotation1:identity,axis:'Z',limit:{enabled:true,lower:null,upper:90},breakForce:1000,breakTorque:1000}],
  materials:[{path:'/Material',density:3,staticFriction:.4,dynamicFriction:.3,restitution:.2}],
  scenes:[{path:'/Scene',gravityDirection:[0,0,-1],gravityMagnitude:981}],
 };
}

test('glTF normalization converts spatial and mass quantities once without changing the source',()=>{
 const source=spatialFixture(),before=structuredClone(source);freeze(source);
 const result=toGltfPhysicsSnapshot(source),body=result.bodies[0],shape=result.shapes[0],joint=result.joints[0];
 assert.deepEqual(source,before);
 for(const key of ['metersPerUnit','kilogramsPerUnit','upAxis'])assert.equal(Object.hasOwn(result,key),false);
 vector(body.position,[1,3,-2]);vector(body.linearVelocity,[.1,.3,-.2]);vector(body.angularVelocity,[Math.PI/2,3*Math.PI/2,-Math.PI]);
 close(body.mass,1);close(body.density,1000);vector(body.centerOfMass,[.1,.2,.3]);vector(body.diagonalInertia,[.001,.002,.003]);
 vector(body.scale,[2,3,4]);vector(body.principalAxes,before.bodies[0].principalAxes);
 vector(rotate([0,0,1],body.rotation),[0,1,0]);
 vector(shape.position,[.1,.2,.3]);vector(shape.rotation,before.shapes[0].rotation);vector(shape.halfExtents,[.2,.3,.4]);
 close(shape.mass,.5);close(shape.density,2000);vector(shape.centerOfMass,[.01,.02,.03]);vector(shape.diagonalInertia,[.00001,.00002,.00003]);
 vector(joint.position0,[1,3,-2]);vector(joint.position1,[.1,.2,.3]);vector(rotate([0,0,1],joint.rotation0),[0,1,0]);vector(joint.rotation1,identity);
 assert.equal(joint.limit.lower,null);close(joint.limit.upper,Math.PI/2);close(joint.breakForce,.01);close(joint.breakTorque,.0001);
 close(result.materials[0].density,3000);close(result.materials[0].staticFriction,.4);
 vector(result.scenes[0].gravityDirection,[0,-1,0]);close(result.scenes[0].gravityMagnitude,9.81);
});

test('static axes and collision points retain their local frames without a second basis rotation',()=>{
 const result=toGltfPhysicsSnapshot(spatialFixture()),plane=result.shapes[1],mesh=result.shapes[2],owned=result.shapes[3];
 assert.equal(plane.axis,'Z');vector(rotate([0,0,1],plane.rotation),[0,1,0]);
 vector(mesh.points,[0,0,0,1,0,0,0,1,0]);assert.deepEqual(mesh.indices,[0,1,2]);vector(mesh.meshScale,[2,3,4]);
 vector(owned.points,mesh.points);vector(owned.position,[.1,.2,.3]);vector(owned.rotation,identity);
 // The source vertex [0,100,0], scaled by [2,3,4] and translated by
 // [100,200,300], is [100,500,300] cm: [1,3,-5] in glTF metres.
 const world=new Vector3(...mesh.points.slice(6,9)).multiply(new Vector3(...mesh.meshScale)).applyQuaternion(new Quaternion(...mesh.rotation)).add(new Vector3(...mesh.position));
 vector(world.toArray(),[1,3,-5]);
});

test('normalization keeps converted collision coordinates in double precision until mesh serialization',()=>{
 const source={...empty(),shapes:[{path:'/Mesh',type:'mesh',points:new Float32Array([1,2,3]),indices:[]}]};
 const before=source.shapes[0].points.slice(),result=toGltfPhysicsSnapshot(source);
 assert.equal(result.shapes[0].points[0],.01);
 assert.notEqual(result.shapes[0].points[0],Math.fround(.01));
 assert.deepEqual(source.shapes[0].points,before);
});

function jointFixture(){
 const drive=acceleration=>({enabled:true,targetPosition:90,targetVelocity:180,stiffness:100,damping:20,forceLimit:1000,acceleration});
 return {...empty(),joints:[
  {path:'/AngularForce',type:'revolute',limit:{enabled:true,lower:-90,upper:180},drive:drive(false)},
  {path:'/AngularAcceleration',type:'revolute',drive:drive(true)},
  {path:'/LinearForce',type:'prismatic',limit:{enabled:true,lower:0,upper:100},drive:drive(false),minDistance:10,maxDistance:100},
  {path:'/LinearAcceleration',type:'prismatic',drive:drive(true)},
  {path:'/Cone',type:'spherical',limit:{enabled:true,lower:30,upper:60}},
  {path:'/LinearFollower',type:'prismatic',mimic:{joint:'/AngularForce',multiplier:2,offset:10}},
  {path:'/AngularFollower',type:'revolute',mimic:{joint:'/LinearForce',multiplier:3,offset:45}},
  {path:'/SameKindFollower',type:'revolute',mimic:{joint:'/AngularForce',multiplier:-2,offset:45}},
 ]};
}

test('joint limits, force drives, acceleration drives and mixed-coordinate mimic use canonical units',()=>{
 const source=jointFixture(),before=structuredClone(source);freeze(source);
 const result=toGltfPhysicsSnapshot(source),[angular,angularAccel,linear,linearAccel,cone,linearFollower,angularFollower,sameKind]=result.joints;
 close(angular.limit.lower,-Math.PI/2);close(angular.limit.upper,Math.PI);
 close(angular.drive.targetPosition,Math.PI/2);close(angular.drive.targetVelocity,Math.PI);
 close(angular.drive.stiffness,.00001/radians);close(angular.drive.damping,.000002/radians);close(angular.drive.forceLimit,.0001);
 close(angularAccel.drive.stiffness,100);close(angularAccel.drive.damping,20);close(angularAccel.drive.targetPosition,Math.PI/2);close(angularAccel.drive.forceLimit,.0001);
 close(linear.limit.upper,1);close(linear.drive.targetPosition,.9);close(linear.drive.targetVelocity,1.8);close(linear.drive.stiffness,.1);close(linear.drive.damping,.02);close(linear.drive.forceLimit,.01);
 close(linear.minDistance,.1);close(linear.maxDistance,1);close(linearAccel.drive.stiffness,100);close(linearAccel.drive.damping,20);
 close(cone.limit.lower,Math.PI/6);close(cone.limit.upper,Math.PI/3);
 close(linearFollower.mimic.multiplier,.02/radians);close(linearFollower.mimic.offset,.1);
 close(angularFollower.mimic.multiplier,300*radians);close(angularFollower.mimic.offset,Math.PI/4);
 close(sameKind.mimic.multiplier,-2);close(sameKind.mimic.offset,Math.PI/4);
 close(linearFollower.mimic.multiplier*(Math.PI/2)+linearFollower.mimic.offset,1.9);
 close(angularFollower.mimic.multiplier*.9+angularFollower.mimic.offset,315*radians);
 assert.deepEqual(source,before);
});

test('generic shared-world conversion preserves degree cones and rescales mixed mimic relationships',()=>{
 const result=transformSnapshot(jointFixture());
 close(result.joints[4].limit.lower,30);close(result.joints[4].limit.upper,60);
 close(result.joints[5].mimic.multiplier,.02);close(result.joints[5].mimic.offset,.1);
 close(result.joints[6].mimic.multiplier,300);close(result.joints[6].mimic.offset,45);
});

test('the runtime boundary restores degrees while keeping glTF lengths and masses in SI',()=>{
 const wire=toGltfPhysicsSnapshot({...spatialFixture(),joints:jointFixture().joints}),before=structuredClone(wire);freeze(wire);
 const runtime=fromGltfPhysicsSnapshot(wire);
 assert.equal(runtime.metersPerUnit,1);assert.equal(runtime.kilogramsPerUnit,1);assert.equal(runtime.upAxis,'Y');
 vector(runtime.bodies[0].position,[1,3,-2]);vector(runtime.bodies[0].angularVelocity,[90,270,-180]);close(runtime.bodies[0].mass,1);
 close(runtime.joints[0].limit.upper,180);close(runtime.joints[0].drive.stiffness,.00001);close(runtime.joints[1].drive.stiffness,100);
 close(runtime.joints[2].limit.upper,1);close(runtime.joints[5].mimic.multiplier,.02);close(runtime.joints[6].mimic.multiplier,300);
 assert.deepEqual(wire,before);
 const roundtrip=toGltfPhysicsSnapshot(runtime);
 for(let i=0;i<wire.joints.length;i++){
  const a=roundtrip.joints[i],b=wire.joints[i];
  if(a.limit){close(a.limit.lower,b.limit.lower);close(a.limit.upper,b.limit.upper);}
  if(a.drive)for(const key of ['targetPosition','targetVelocity','stiffness','damping','forceLimit'])close(a.drive[key],b.drive[key]);
  if(a.mimic){close(a.mimic.multiplier,b.mimic.multiplier);close(a.mimic.offset,b.mimic.offset);}
 }
});

test('normalization rejects invalid source units and unknown dimensional joints',()=>{
 for(const overrides of [{metersPerUnit:0},{metersPerUnit:-1},{metersPerUnit:Infinity},{kilogramsPerUnit:0},{kilogramsPerUnit:NaN},{upAxis:'Q'}])assert.throws(()=>toGltfPhysicsSnapshot({...empty(),...overrides}),/Invalid/);
 for(const field of [{limit:{enabled:true,lower:0,upper:1}},{drive:{enabled:true,targetPosition:1,targetVelocity:0,stiffness:1,damping:1}},{mimic:{joint:'/Other',multiplier:1,offset:0}}])assert.throws(()=>toGltfPhysicsSnapshot({...empty(),joints:[{path:'/Unknown',type:'vendor:joint',...field}]}),/unknown joint type/);
 assert.throws(()=>toGltfPhysicsSnapshot({...empty(),shapes:[{path:'/Plane',type:'plane',rotation:[0,0,0,0]}]}),/rotation/);
 assert.throws(()=>toGltfPhysicsSnapshot({...empty(),joints:[{path:'/Joint',type:'fixed',rotation0:[0,0,0,0]}]}),/rotation/);
 assert.throws(()=>toGltfPhysicsSnapshot({...empty(),joints:[{path:'/Follower',type:'revolute',mimic:{joint:'/Missing',multiplier:1,offset:0}}]}),/Mimic reference/);
});

test('Rapier angular acceleration gains match the same linear acceleration response',async()=>{
 await R.init();
 const make=type=>({...empty(),metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[{path:'/Zero',gravityMagnitude:0}],
  bodies:[{path:'/Body',position:[0,0,0],rotation:identity,mass:2,diagonalInertia:[2,2,2]}],
  joints:[{path:'/Drive',type,body0:'',body1:'/Body',axis:'X',drive:{enabled:true,targetPosition:type==='revolute'?1/radians:1,targetVelocity:0,stiffness:100,damping:20,acceleration:true}}]});
 const angular=await createSimulation({snapshot:make('revolute'),rapier:R}),linear=await createSimulation({snapshot:make('prismatic'),rapier:R});
 try{
  for(let step=0;step<12;step++){angular.step();linear.step();}
  const angle=angular.getJointValue('/Drive')*radians,position=linear.getJointValue('/Drive');
  assert.ok(position>.15&&position<.4,`damped response should advance toward the target: ${position}`);
  close(angle,position,1e-3);
  angular.reset();linear.reset();
  for(let step=0;step<12;step++){angular.step();linear.step();}
  close(angular.getJointValue('/Drive')*radians,linear.getJointValue('/Drive'),1e-3);
 }finally{angular.dispose();linear.dispose();}
});
