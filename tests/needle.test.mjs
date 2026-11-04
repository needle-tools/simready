import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Object3D, InstancedMesh, BoxGeometry, MeshBasicMaterial} from 'three';
import R from '@dimforge/rapier3d-compat';
import {createNeedleWorld} from '../src/needle/world.js';
import {bindVisuals} from '../src/three.js';

await R.init();
const q=[0,0,0,1];
const snapshot=()=>({metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],joints:[],unsupported:[],
 bodies:[{path:'/Body',position:[0,2,0],rotation:q,mass:2}],
 shapes:[{path:'/Body/Shape',body:'/Body',type:'cube',halfExtents:[.5,.5,.5],position:[0,0,0],rotation:q},
 {path:'/Floor',body:'',type:'cube',halfExtents:[5,.5,5],position:[0,-.5,0],rotation:q}]});
function host(){
 const world=new R.World({x:0,y:-9.81,z:0}),scene=new Object3D(),registrations=[],extensions=new Set();
 const physics={world,async initialize(){},registerWorldExtension(extension){extensions.add(extension);return()=>extensions.delete(extension);},
  registerExternalPhysics(options){
   for(const {body}of options.bodies)assert.equal(body.isEnabled(),false,'registration precedes physics activation');
   for(const {collider}of options.colliders)assert.equal(collider.isEnabled(),false);
   const registration={options,disposed:0,rigidbodies:new Map(options.bodies.map(({body})=>[body.handle,{body}])),colliders:new Map(options.colliders.map(({collider})=>[collider.handle,{collider}])),
    dispose(){this.disposed++;for(const {body}of options.bodies)assert.equal(body.isValid(),true,'unregister before raw body removal');this.rigidbodies.clear();this.colliders.clear();}};
   registrations.push(registration);return registration;
  }};
 return {world,scene,registrations,extensions,context:{scene,physics:{engine:physics,getOrCreatePhysicsEngine(){return physics;}}},engine:{NEEDLE_ENGINE_MODULES:{RAPIER_PHYSICS:{MODULE:R}}}};
}
test('Needle bridge registers raw objects and visual identities while Engine owns component adaptation',async()=>{
 const h=host(),root=new Object3D(),object=new Object3D();h.scene.add(root);root.add(object);object.position.y=2;root.updateMatrixWorld(true);
 const sim=await createNeedleWorld(h.engine,{context:h.context});
 try{
  const asset=await sim.addAsset({snapshot:snapshot(),bindVisuals:(bodies,_warn,_signal,colliders)=>{
   assert.equal(colliders.size,2);return bindVisuals({root,bodies,bindings:[{body:'/Body',object}],worldSpace:true});
  }});
  const registration=h.registrations[0];
  assert.equal(registration.options.root,root);assert.equal(registration.options.syncTransforms,false);
  assert.equal(registration.options.bodies[0].object,object);assert.equal(registration.options.colliders[0].object,object);
  assert.equal(registration.options.colliders[1].object,undefined,'unowned static collider is included');
  assert.equal(asset.rigidbodies.get('/Body').body,asset.bodies.get('/Body').body);
  const extension=[...h.extensions][0],events=new R.EventQueue(true);
  try{for(let i=0;i<240;i++){h.world.step(events,extension.hooks);extension.afterStep();}}finally{events.free();}
  assert.ok(Math.abs(object.matrix.elements[13]-.5)<.04);
  asset.reset();assert.equal(registration.disposed,0,'reset retains Engine identity');
  assert.equal(asset.bodies.get('/Body').body.translation().y,2);
  registration.options.onDestroy();assert.equal(sim.assets.size,0);assert.equal(registration.disposed,1);
  assert.equal(h.world.bodies.len(),0);assert.equal(h.world.colliders.len(),0);
  asset.dispose();assert.equal(registration.disposed,1);
 }finally{sim.dispose();h.world.free();}
});
test('instances request distinct Engine-owned identities instead of sharing one render node',async()=>{
 const h=host(),root=new Object3D(),mesh=new InstancedMesh(new BoxGeometry(),new MeshBasicMaterial(),2);root.add(mesh);h.scene.add(root);
 const sim=await createNeedleWorld(h.engine,{context:h.context});
 try{
  const source=snapshot();source.bodies.push({...source.bodies[0],path:'/Second',position:[2,2,0]});
  await sim.addAsset({snapshot:source,bindVisuals:bodies=>bindVisuals({root,bodies,bindings:[{object:mesh,body:'/Body',instanceIndex:0},{object:mesh,body:'/Second',instanceIndex:1}],worldSpace:true})});
  assert.deepEqual(h.registrations[0].options.bodies.map(record=>record.object),[undefined,undefined]);
 }finally{sim.dispose();h.world.free();mesh.geometry.dispose();mesh.material.dispose();}
});
test('strict visual warning unregisters adaptation and preserves unrelated Engine resources',async()=>{
 const h=host(),ground=h.world.createCollider(R.ColliderDesc.ball(1)),sim=await createNeedleWorld(h.engine,{context:h.context});let disposed=0;
 try{
  await assert.rejects(sim.addAsset({snapshot:snapshot(),bindVisuals:(_bodies,warn)=>{
   warn({path:'/Body'},'Missing render binding');return {sync(){},reset(){},dispose(){disposed++;},bodyForObject(){return null;}};
  }}),/Missing render binding/);
  assert.equal(h.registrations[0].disposed,1);assert.equal(disposed,1);assert.equal(h.world.bodies.len(),0);assert.equal(ground.isValid(),true);
 }finally{sim.dispose();h.world.free();}
});
test('Engine teardown cancels pending bindings before external registration and frees raw resources',async()=>{
 const h=host(),sim=await createNeedleWorld(h.engine,{context:h.context});let resolve,disposed=0;
 const pending=sim.addAsset({snapshot:snapshot(),bindVisuals:()=>new Promise(done=>{resolve=()=>done({sync(){},reset(){},dispose(){disposed++;},bodyForObject(){return null;}});})});
 [...h.extensions][0].dispose();assert.equal(h.world.bodies.len(),0);h.world.free();resolve();
 await assert.rejects(pending,{name:'AbortError'});assert.equal(h.registrations.length,0);assert.equal(disposed,1);
});
test('Engine teardown after registration releases adaptation before the borrowed world',async()=>{
 const h=host(),sim=await createNeedleWorld(h.engine,{context:h.context});
 await sim.addAsset({snapshot:snapshot()});[...h.extensions][0].dispose();
 assert.equal(h.registrations[0].disposed,1);assert.equal(h.world.bodies.len(),0);h.world.free();sim.dispose();
});
test('split meshes use a shared body ancestor while multiple body groups remain separate',async()=>{
 const h=host(),root=new Object3D(),group=new Object3D(),first=new Object3D(),second=new Object3D(),other=new Object3D();
 h.scene.add(root);root.add(group,other);group.add(first,second);
 const sim=await createNeedleWorld(h.engine,{context:h.context});
 try{
  const source=snapshot();source.bodies.push({...source.bodies[0],path:'/Other',position:[2,2,0]});
  await sim.addAsset({snapshot:source,bindVisuals:bodies=>bindVisuals({root,bodies,bindings:[{object:first,body:'/Body'},{object:second,body:'/Body'},{object:other,body:'/Other'}],worldSpace:true})});
  assert.deepEqual(h.registrations[0].options.bodies.map(record=>record.object),[group,other]);
 }finally{sim.dispose();h.world.free();}
});
