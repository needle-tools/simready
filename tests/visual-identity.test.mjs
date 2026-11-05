import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {Object3D,InstancedMesh,BoxGeometry,MeshBasicMaterial,Vector3} from 'three';
import {createSimulationWorld} from '../src/rapier.js';
import {bindVisuals} from '../src/three.js';
await R.init();
test('nested visuals follow their owners independently of binding order and reset their local poses',()=>{
 for(const worldSpace of [false,true]){
  const root=new Object3D(),parent=new Object3D(),child=new Object3D();
  root.position.x=10;parent.position.x=1;child.position.x=1;root.add(parent);parent.add(child);
  let x=worldSpace?11:1;
  const owner={data:{path:'/Body',position:[1,0,0],rotation:[0,0,0,1]},body:{translation:()=>({x,y:0,z:0}),rotation:()=>({x:0,y:0,z:0,w:1})}};
  const binding=bindVisuals({root,bodies:new Map([['/Body',owner]]),bindings:[{object:child,body:'/Body'},{object:parent,body:'/Body'}],worldSpace});
  for(let step=1;step<=3;step++){
   x++;binding.sync();
   assert.equal(parent.getWorldPosition(new Vector3()).x,11+step);
   assert.equal(child.getWorldPosition(new Vector3()).x,12+step);
  }
  binding.reset();
  assert.equal(parent.position.x,1);assert.equal(child.position.x,1);
  assert.equal(parent.matrixAutoUpdate,true);assert.equal(child.matrixAutoUpdate,true);
  assert.equal(child.getWorldPosition(new Vector3()).x,12);
 }
});
test('visual identity survives pause, reset and body types while drag eligibility remains separate',async()=>{
 const q=[0,0,0,1],paths=['/Dynamic','/Fixed','/Kinematic'];
 const snapshot={metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],joints:[],unsupported:[],shapes:[],bodies:paths.map((path,i)=>({path,position:[i*2,0,0],rotation:q,mass:1,...i===1?{rigidBodyEnabled:false}:i===2?{kinematicBody:true}:{}}))};
 const root=new Object3D(),objects=paths.map(()=>new Object3D()),child=new Object3D(),instances=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),3);
 root.add(objects[0],objects[2],instances);objects[0].add(objects[1]);objects[1].add(child);
 const host=createSimulationWorld({rapier:R,gravity:[0,0,0]});
 try{
  const asset=await host.addAsset({snapshot,bindVisuals:bodies=>bindVisuals({root,bodies,bindings:[...paths.map((body,i)=>({body,object:objects[i]})),...paths.map((body,instanceIndex)=>({body,object:instances,instanceIndex}))]})});
  const identities=paths.map(path=>asset.bodies.get(path));
  const check=()=>{paths.forEach((path,i)=>{assert.equal(asset.bodyForObject(objects[i]),identities[i],path);assert.equal(asset.bodyForObject(instances,i),identities[i],path+' instance');});assert.equal(asset.bodyForObject(child),identities[1],'nearest fixed owner takes precedence over dynamic ancestor');};
  check();asset.play();assert.equal(asset.beginDrag('/Dynamic',{x:0,y:0,z:0}),true);asset.endDrag();
  assert.equal(asset.beginDrag('/Fixed',{x:2,y:0,z:0}),false);assert.equal(asset.beginDrag('/Kinematic',{x:4,y:0,z:0}),false);
  for(let cycle=0;cycle<2;cycle++){
   asset.pause();assert.equal(identities[0].body.isFixed(),true);check();assert.equal(asset.beginDrag('/Dynamic',{x:0,y:0,z:0}),false);
   asset.play();check();assert.equal(identities[0].body.isDynamic(),true);
   asset.reset();check();
  }
  asset.dispose();assert.equal(asset.bodyForObject(objects[0]),null);
 }finally{host.dispose();instances.geometry.dispose();instances.material.dispose();}
});
