import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Object3D, InstancedMesh, BoxGeometry, MeshBasicMaterial} from 'three';
import R from '@dimforge/rapier3d-compat';
import {createNeedleWorld} from '../src/needle/world.js';
import {bindVisuals} from '../src/three.js';
import {rapierCapabilities} from '../src/description.js';
import {buildRapierAsset} from '../src/rapierAsset.js';

await R.init();
const q=[0,0,0,1];
const snapshot=()=>({metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],joints:[],unsupported:[],
 bodies:[{path:'/Body',position:[0,2,0],rotation:q,mass:2}],
 shapes:[{path:'/Body/Shape',body:'/Body',type:'cube',halfExtents:[.5,.5,.5],position:[0,0,0],rotation:q},
 {path:'/Floor',body:'',type:'cube',halfExtents:[5,.5,5],position:[0,-.5,0],rotation:q}]});

/** A stand-in for Engine's physics assets that records descriptions and simulates them with Rapier. */
function host(){
 const world=new R.World({x:0,y:-9.81,z:0}),events=new R.EventQueue(true),scene=new Object3D(),assets=[],listeners=new Set();
 const handles=new Map();
 const hooks={filterContactPair(a,b){for(const asset of assets)if(!asset.isDisposed&&!asset.filter(a,b))return null;return R.SolverFlags.COMPUTE_IMPULSE;},filterIntersectionPair(){return true;}};
 const physics={capabilities:rapierCapabilities(R),async initialize(){return true;},
  onWorldDisposed(callback){listeners.add(callback);return()=>listeners.delete(callback);},
  createAsset(description){
   const {joints=[],...source}=description,external=joints.filter(joint=>typeof joint.body0==='object');
   // Engine fills omitted body fields; SimReady's builder expects complete descriptions.
   const zero={x:0,y:0,z:0},rest={...source,bodies:(source.bodies||[]).map(body=>({rotation:{...zero,w:1},linearVelocity:zero,angularVelocity:zero,sleeping:false,continuousCollision:false,...body}))};
   const built=buildRapierAsset({rapier:R,world,warn(){},description:{bodies:[],colliders:[],articulations:[],...rest,joints:joints.filter(joint=>!external.includes(joint)),colliderData:new Map(),jointData:new Map()}});
   const extra=external.map(joint=>world.createImpulseJoint(R.JointData.spring(0,joint.spring.stiffness,joint.spring.damping,joint.anchor0,{x:0,y:0,z:0}),joint.body0.body,built.bodies.get(joint.body1),true));
   const component=body=>({body});
   const bodies=new Map([...built.bodies].map(([id,body])=>{const handle={id,component:component(body),get isValid(){return body.isValid();},get type(){return body.isDynamic()?'dynamic':body.isFixed()?'fixed':'kinematic';},
    get isSleeping(){return body.isSleeping();},get mass(){return body.mass();},getPosition:()=>({...body.translation()}),getRotation:()=>({...body.rotation()}),
    setPose({position,rotation},wake=true){if(position)body.setTranslation(position,wake);if(rotation)body.setRotation(rotation,wake);},setKinematicTarget({position}){body.setNextKinematicTranslation(position);},
    getLinearVelocity:()=>({...body.linvel()}),setLinearVelocity:(value,wake=true)=>body.setLinvel(value,wake),getAngularVelocity:()=>({...body.angvel()}),setAngularVelocity:(value,wake=true)=>body.setAngvel(value,wake),
    resetForces(wake=true){body.resetForces(wake);body.resetTorques(wake);},sleep:()=>body.sleep(),wakeUp:()=>body.wakeUp()};handles.set(body.handle,handle);return [id,handle];}));
   const colliders=new Map([...built.colliders].map(([id,collider])=>[id,{id,body:bodies.get(rest.colliders.find(item=>item.id===id)?.body)??null,component:{collider},get isValid(){return collider.isValid();}}]));
   const byHandle=new Map([...built.colliders].map(([id,collider])=>[collider.handle,colliders.get(id)]));
   const joints2=new Map([...built.joints].map(([id])=>[id,{id,isValid:true,setDriveTarget:({position=0,velocity=0})=>built.setDriveTarget(id,position,velocity)}]));
   const release=()=>{if(asset.isDisposed)return false;asset.isDisposed=true;for(const joint of extra)if(world.impulseJoints.contains(joint.handle))world.removeImpulseJoint(joint,true);built.remove();return true;};
   const asset={description,bodies,colliders,joints:joints2,issues:[],adaptations:built.adaptations.map(({path,...item})=>({id:path,...item})),isDisposed:false,disposals:0,
    filter(a,b){const c0=byHandle.get(a),c1=byHandle.get(b);return !c0||!c1||!description.shouldCollide||description.shouldCollide(c0,c1);},
    hold:()=>built.hold(),release:()=>built.release(),dispose(){this.disposals++;release();},destroy(){if(release())description.onDestroy?.();}};
   assets.push(asset);return asset;
  }};
 const step=count=>{for(let i=0;i<count;i++){world.step(events,hooks);for(const asset of assets)if(!asset.isDisposed)asset.description.onAfterStep?.();}};
 const disposeWorld=()=>{for(const listener of [...listeners])listener();for(const asset of assets)asset.destroy();};
 return {world,scene,assets,step,disposeWorld,free(){events.free();world.free();},context:{scene,physics:{getOrCreatePhysicsEngine(){return physics;}}}};
}
test('Needle world creates one Engine physics asset with visual identities and steps through Engine callbacks',async()=>{
 const h=host(),root=new Object3D(),object=new Object3D();h.scene.add(root);root.add(object);object.position.y=2;root.updateMatrixWorld(true);
 const sim=await createNeedleWorld({context:h.context});
 try{
  const asset=await sim.addAsset({snapshot:snapshot(),bindVisuals:(bodies,_warn,_signal,colliders)=>{
   assert.equal(h.assets.length,0,'visuals bind before Engine creates physics');
   assert.equal(colliders.size,2);assert.equal(bodies.get('/Body').body.translation().y,2);
   return bindVisuals({root,bodies,bindings:[{body:'/Body',object}],worldSpace:true});
  }});
  const [engine]=h.assets,description=engine.description;
  assert.equal(description.root,root);assert.equal(description.syncTransforms,false);
  assert.equal(description.bodies[0].object,object);assert.equal(description.colliders[0].object,object);
  assert.equal(description.colliders[1].object,undefined,'unowned static collider is included');
  assert.equal(asset.rigidbodies.get('/Body'),engine.bodies.get('/Body').component);
  assert.equal(asset.colliderComponents.get('/Body/Shape'),engine.colliders.get('/Body/Shape').component);
  assert.equal(asset.bodies.get('/Body').colliders[0],engine.colliders.get('/Body/Shape'));
  asset.play();h.step(240);
  assert.ok(Math.abs(object.matrix.elements[13]-.5)<.04);
  asset.reset();assert.equal(engine.disposals,0,'reset retains Engine identity');
  assert.equal(asset.bodies.get('/Body').body.translation().y,2);
  engine.destroy();assert.equal(sim.assets.size,0);assert.equal(h.world.bodies.len(),0);
  assert.equal(object.matrixAutoUpdate,true,'Engine release restores the visual binding');
  asset.dispose();assert.equal(engine.disposals,0,'the Engine already released the asset');
 }finally{sim.dispose();h.free();}
});
test('instances request distinct Engine-owned identities instead of sharing one render node',async()=>{
 const h=host(),root=new Object3D(),mesh=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),2);root.add(mesh);h.scene.add(root);
 const sim=await createNeedleWorld({context:h.context});
 try{
  const source=snapshot();source.bodies.push({...source.bodies[0],path:'/Second',position:[2,2,0]});
  await sim.addAsset({snapshot:source,bindVisuals:bodies=>bindVisuals({root,bodies,bindings:[{object:mesh,body:'/Body',instanceIndex:0},{object:mesh,body:'/Second',instanceIndex:1}],worldSpace:true})});
  assert.deepEqual(h.assets[0].description.bodies.map(record=>record.object),[undefined,undefined]);
 }finally{sim.dispose();h.free();mesh.geometry.dispose();mesh.material.dispose();}
});
test('strict visual warning creates no Engine physics and preserves unrelated resources',async()=>{
 const h=host(),ground=h.world.createCollider(R.ColliderDesc.ball(1)),sim=await createNeedleWorld({context:h.context});let disposed=0;
 try{
  await assert.rejects(sim.addAsset({snapshot:snapshot(),bindVisuals:(_bodies,warn)=>{
   warn({path:'/Body'},'Missing render binding');return {sync(){},reset(){},dispose(){disposed++;},bodyForObject(){return null;}};
  }}),/Missing render binding/);
  assert.equal(h.assets.length,0);assert.equal(disposed,1);assert.equal(h.world.bodies.len(),0);assert.equal(ground.isValid(),true);
 }finally{sim.dispose();h.free();}
});
test('Engine teardown cancels pending bindings before any Engine physics is created',async()=>{
 const h=host(),sim=await createNeedleWorld({context:h.context});let resolve,disposed=0;
 const pending=sim.addAsset({snapshot:snapshot(),bindVisuals:()=>new Promise(done=>{resolve=()=>done({sync(){},reset(){},dispose(){disposed++;},bodyForObject(){return null;}});})});
 await new Promise(done=>setTimeout(done));
 h.disposeWorld();resolve();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(h.assets.length,0);assert.equal(disposed,1);h.free();
});
test('Engine teardown after creation releases the asset before the world',async()=>{
 const h=host(),sim=await createNeedleWorld({context:h.context});
 const asset=await sim.addAsset({snapshot:snapshot()});h.disposeWorld();
 assert.equal(h.assets[0].isDisposed,true);assert.equal(h.world.bodies.len(),0);assert.equal(sim.assets.size,0);
 assert.equal(asset.isPlaying(),false);h.free();sim.dispose();
});
test('split meshes use a shared body ancestor while multiple body groups remain separate',async()=>{
 const h=host(),root=new Object3D(),group=new Object3D(),first=new Object3D(),second=new Object3D(),other=new Object3D();
 h.scene.add(root);root.add(group,other);group.add(first,second);
 const sim=await createNeedleWorld({context:h.context});
 try{
  const source=snapshot();source.bodies.push({...source.bodies[0],path:'/Other',position:[2,2,0]});
  await sim.addAsset({snapshot:source,bindVisuals:bodies=>bindVisuals({root,bodies,bindings:[{object:first,body:'/Body'},{object:second,body:'/Body'},{object:other,body:'/Other'}],worldSpace:true})});
  assert.deepEqual(h.assets[0].description.bodies.map(record=>record.object),[group,other]);
 }finally{sim.dispose();h.free();}
});
test('dragging creates a temporary spring asset against the Engine body and releases it',async()=>{
 const h=host(),sim=await createNeedleWorld({context:h.context});
 try{
  const asset=await sim.addAsset({snapshot:snapshot()});asset.play();
  assert.equal(asset.beginDrag('/Body',{x:0,y:2,z:0}),true);
  const drag=h.assets[1];
  assert.deepEqual(drag.description.joints.map(joint=>[joint.type,joint.body0,joint.body1]),[['spring',asset.rigidbodies.get('/Body'),'anchor']]);
  asset.moveDrag({x:0,y:4,z:0});h.step(120);
  assert.ok(asset.bodies.get('/Body').body.translation().y>2.5,'the spring lifts the body toward the pointer');
  asset.endDrag();assert.equal(drag.isDisposed,true);assert.equal(asset.bodies.get('/Body').body.isValid(),true);
 }finally{sim.dispose();h.free();}
});
test('collision filters and drives reach Engine through the description',async()=>{
 const h=host(),sim=await createNeedleWorld({context:h.context});
 try{
  const source=snapshot();
  source.bodies.push({path:'/Slide',position:[0,2,0],rotation:q,mass:1});
  source.shapes.push({path:'/Slide/Shape',body:'/Slide',type:'cube',halfExtents:[.1,.1,.1],position:[0,0,0],rotation:q,filteredCollisions:['/Body']});
  source.joints.push({path:'/Rail',type:'prismatic',body1:'/Slide',position0:[0,2,0],position1:[0,0,0],rotation0:q,rotation1:q,axis:'X',
   drive:{enabled:true,targetPosition:0,targetVelocity:0,stiffness:100,damping:10,acceleration:true}});
  const asset=await sim.addAsset({snapshot:source});
  const description=h.assets[0].description;
  assert.equal(description.shouldCollide(h.assets[0].colliders.get('/Slide/Shape'),h.assets[0].colliders.get('/Body/Shape')),false);
  assert.equal(description.shouldCollide(h.assets[0].colliders.get('/Slide/Shape'),h.assets[0].colliders.get('/Floor')),true);
  assert.equal(description.joints[0].drive.model,'acceleration');
  assert.equal(asset.setJointTarget('/Rail',{position:.5}),true);
  assert.equal(asset.setJointTarget('/Missing',{position:.5}),false);
 }finally{sim.dispose();h.free();}
});
test('an Engine without physics assets fails with an update hint',async()=>{
 const context={scene:new Object3D(),physics:{getOrCreatePhysicsEngine(){return {initialize(){},registerExternalPhysics(){}};}}};
 await assert.rejects(createNeedleWorld({context}),/does not support physics assets/);
});
