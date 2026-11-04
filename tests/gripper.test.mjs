import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '../src/rapier.js';
await R.init();
const q=[0,0,0,1];
function fixture(forceLimit=20){
 const bodies=['Left','Right'].map((name,i)=>({path:'/'+name,position:[i?.3:-.3,1.5,0],rotation:q,scale:[1,1,1],mass:.5,rigidBodyEnabled:true}));
 const shapes=bodies.map(body=>({path:body.path+'/Collider',body:body.path,type:'cube',halfExtents:[.05,.4,.3],position:[0,0,0],rotation:q,materials:['/Grip']}));
 const joints=bodies.map((body,i)=>({path:body.path+'/Slide',type:'prismatic',axis:'X',body0:'',body1:body.path,position0:body.position,position1:[0,0,0],rotation0:q,rotation1:q,limit:{enabled:true,lower:i?-.15:0,upper:i?0:.15},drive:{enabled:true,targetPosition:i?-.1:.1,targetVelocity:0,stiffness:1000,damping:100,forceLimit,acceleration:false}}));
 return {metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',bodies,shapes,joints,materials:[{path:'/Grip',staticFriction:1,dynamicFriction:1,restitution:0}],groups:[],scenes:[],unsupported:[]};
}
const object=()=>({metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',bodies:[{path:'/Box',position:[0,1.5,0],rotation:q,scale:[1,1,1],mass:1,rigidBodyEnabled:true}],shapes:[{path:'/Box/Collider',body:'/Box',type:'cube',halfExtents:[.2,.2,.2],position:[0,0,0],rotation:q,materials:[]}],joints:[],materials:[],groups:[],scenes:[],unsupported:[]});
async function run(forceLimit){
 const world=createSimulationWorld({rapier:R});
 try{
  const gripper=await world.addAsset({id:'gripper',snapshot:fixture(forceLimit)});
  const box=await world.addAsset({id:'box',snapshot:object()});
  await world.addAsset({id:'floor',snapshot:{...object(),bodies:[],shapes:[{path:'/Ground',type:'cube',body:'',halfExtents:[5,.5,5],position:[0,-.5,0],rotation:q}]}});
  for(let i=0;i<360;i++)world.step();
  const held=box.bodies.get('/Box').body.translation().y,stalled=gripper.getJointValue('/Left/Slide');
  gripper.setJointTarget('/Left/Slide',{position:0});gripper.setJointTarget('/Right/Slide',{position:0});
  for(let i=0;i<360;i++)world.step();
  return {held,stalled,released:box.bodies.get('/Box').body.translation().y};
 }finally{world.dispose();}
}
test('force-limited fingers grip a separately imported object against gravity and release it',async()=>{
 const result=await run(20);
 assert.ok(result.held>1.1,'held height '+result.held);
 assert.ok(result.stalled>.035&&result.stalled<.075,'motor stalls at contact: '+result.stalled);
 assert.ok(Math.abs(result.released-.2)<.03,'released object settles on floor: '+result.released);
});
test('an insufficient grip force cannot hold the object by teleporting or overriding contacts',async()=>{
 const result=await run(.5);assert.ok(result.held<.3,'weak grip must drop the box: '+result.held);
});
