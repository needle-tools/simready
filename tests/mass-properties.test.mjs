import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BoxGeometry, Quaternion} from 'three';
import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '../src/rapier.js';
import {computeMassProperties} from '../src/index.js';
await R.init();
const q=[0,0,0,1],empty={metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',bodies:[],shapes:[],joints:[],materials:[],groups:[],scenes:[],unsupported:[]};
const tilted=/** @type {[number,number,number,number]} */(new Quaternion().setFromAxisAngle({x:1,y:2,z:.5},.7).normalize().toArray());
const box=new BoxGeometry(1,2,3),boxMesh={points:Array.from(box.attributes.position.array),indices:Array.from(box.index.array)};box.dispose();
const sorted=v=>[...v].sort((a,b)=>a-b);
function close(actual,expected,tolerance,label){assert.ok(Math.abs(actual-expected)<=tolerance*Math.max(1,Math.abs(expected)),`${label}: ${actual} vs ${expected}`);}

/** Compare against the masses Rapier derives from the same snapshot. */
async function againstRapier(snapshot){
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]});
 try{
  const asset=await host.addAsset({snapshot}),computed=computeMassProperties(snapshot);
  for(const data of snapshot.bodies){
   const body=asset.bodies.get(data.path).body,ours=computed.get(data.path);
   close(ours.mass,body.mass(),1e-4,`${data.path} mass`);
   const com=body.localCom();for(const [i,k] of ['x','y','z'].entries())close(ours.centerOfMass[i],com[k],1e-4,`${data.path} com ${k}`);
   const theirs=sorted(Object.values(body.principalInertia())),mine=sorted(ours.diagonalInertia);
   for(let i=0;i<3;i++)close(mine[i],theirs[i],2e-3,`${data.path} moment ${i}`);
  }
 }finally{host.dispose();}
}

for(const [name,shape] of Object.entries({
 cube:{type:'cube',halfExtents:[.5,1,1.5]},
 sphere:{type:'sphere',radius:.7},
 cylinder:{type:'cylinder',radius:.4,halfHeight:1.1,axis:'X'},
 capsule:{type:'capsule',radius:.3,halfHeight:.8,axis:'Z'},
 cone:{type:'cone',radius:.5,halfHeight:.9,axis:'Y'},
 'closed mesh':{type:'mesh',approximation:'convexHull',...boxMesh},
}))test(`${name} colliders match Rapier's mass, center and principal moments, offset and rotated`,async()=>{
 await againstRapier({...empty,bodies:[{path:'/Body',position:[0,0,0],rotation:q}],
  shapes:[{path:'/Shape',body:'/Body',...shape,position:[.3,-.2,.6],rotation:tilted,density:3}]});
});

test('several colliders combine into one body like Rapier does',async()=>{
 await againstRapier({...empty,bodies:[{path:'/Body',position:[1,2,3],rotation:tilted}],shapes:[
  {path:'/A',body:'/Body',type:'cube',halfExtents:[1,.2,.2],position:[0,0,0],rotation:q,density:2},
  {path:'/B',body:'/Body',type:'sphere',radius:.3,position:[1,.5,0],rotation:q,mass:4},
  {path:'/C',body:'/Body',type:'cylinder',radius:.1,halfHeight:.5,position:[-1,0,0],rotation:tilted,density:7},
  {path:'/D',body:'/Body',type:'capsule',radius:.1,halfHeight:.3,axis:'Y',position:[0,-1,0],rotation:tilted,density:4}]});
});

test('authored collider and body properties take precedence as in the Rapier path',async()=>{
 const shape={path:'/Shape',body:'/Body',type:'cube',halfExtents:[1,1,1],position:[0,0,0],rotation:q,mass:6,centerOfMass:[1,0,0]};
 await againstRapier({...empty,bodies:[{path:'/Body',position:[0,0,0],rotation:q}],shapes:[shape]});
 const computed=computeMassProperties({...empty,bodies:[{path:'/Body',position:[0,0,0],rotation:q,mass:8,centerOfMass:[0,0,0],diagonalInertia:[3,4,5],principalAxes:q}],shapes:[shape]}).get('/Body');
 assert.deepEqual({mass:computed.mass,centerOfMass:computed.centerOfMass,diagonalInertia:computed.diagonalInertia,source:computed.source},
  {mass:8,centerOfMass:[0,0,0],diagonalInertia:[3,4,5],source:'authored'});
});

test('collider density falls back to the body, then its material, then water',()=>{
 const cube={type:'cube',halfExtents:[.5,.5,.5],position:[0,0,0],rotation:q};
 const masses=computeMassProperties({...empty,materials:[{path:'/Steel',density:7800}],bodies:[
  {path:'/Own',position:[0,0,0],rotation:q},{path:'/Body',position:[0,0,0],rotation:q,density:500},
  {path:'/Material',position:[0,0,0],rotation:q},{path:'/Default',position:[0,0,0],rotation:q},{path:'/Empty',position:[0,0,0],rotation:q}],shapes:[
  {path:'/a',body:'/Own',...cube,density:2,materials:['/Steel']},{path:'/b',body:'/Body',...cube,materials:['/Steel']},
  {path:'/c',body:'/Material',...cube,materials:['/Steel']},{path:'/d',body:'/Default',...cube}]});
 assert.deepEqual(['/Own','/Body','/Material','/Default','/Empty'].map(path=>masses.get(path).mass),[2,500,7800,1000,1]);
 assert.equal(masses.get('/Empty').source,'default');
 // Centimetre assets in grams: the default density keeps its physical value.
 const small=computeMassProperties({...empty,metersPerUnit:.01,kilogramsPerUnit:.001,bodies:[{path:'/B',position:[0,0,0],rotation:q}],shapes:[{path:'/s',body:'/B',...cube,halfExtents:[5,5,5]}]});
 close(small.get('/B').mass,1000,1e-9,'1000 cm³ of water in grams');
});

test('open meshes use their bounds instead of an unreliable enclosed volume',()=>{
 const open={points:[0,0,0,2,0,0,0,1,0,2,1,0,0,0,3],indices:[0,1,2,1,3,2]};
 const mass=computeMassProperties({...empty,bodies:[{path:'/B',position:[0,0,0],rotation:q}],shapes:[{path:'/s',body:'/B',type:'mesh',...open,position:[0,0,0],rotation:q,density:1}]}).get('/B');
 assert.equal(mass.mass,6);assert.deepEqual(mass.centerOfMass,[1,.5,1.5]);
});

test('Rapier interaction mode uses the derived mass instead of a unit mass',async()=>{
 const {createSimulation}=await import('../src/rapier.js');
 const snapshot={...empty,bodies:[{path:'/Light',position:[0,0,0],rotation:q},{path:'/Heavy',position:[3,0,0],rotation:q}],shapes:[
  {path:'/l',body:'/Light',type:'sphere',radius:.1,position:[0,0,0],rotation:q,mass:.05},
  {path:'/h',body:'/Heavy',type:'cube',halfExtents:[.5,.5,.5],position:[0,0,0],rotation:q,density:800}]};
 const simulation=await createSimulation({rapier:R,snapshot,mode:'interaction'}),computed=computeMassProperties(snapshot);
 try{
  for(const path of ['/Light','/Heavy']){
   const body=simulation.bodies.get(path).body;
   close(body.mass(),computed.get(path).mass,1e-5,`${path} mass`);
  }
  close(simulation.bodies.get('/Heavy').body.mass(),800,1e-5,'800 kg/m³ cube');
 }finally{simulation.dispose();}
});
