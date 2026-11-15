import {test} from 'node:test';import assert from 'node:assert/strict';import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '../src/rapier.js';import {toGltfPhysicsSnapshot,fromGltfPhysicsSnapshot} from '../src/gltf/coordinates.js';
await R.init();
const source=(gravityScale,continuousCollision)=>({metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],joints:[],bodies:[{path:'/Body',position:[0,3,0],rotation:[0,0,0,1],mass:1,gravityScale,continuousCollision}],shapes:[{path:'/Collider',body:'/Body',type:'sphere',radius:.1}]});
test('authored gravity scaling and CCD are honored in real Rapier bodies and survive glTF units',async()=>{
 const world=createSimulationWorld({rapier:R});
 try{
  const floating=await world.addAsset({snapshot:fromGltfPhysicsSnapshot(toGltfPhysicsSnapshot(source(0,false)))}),falling=await world.addAsset({snapshot:source(1,true),position:[2,0,0]});
  for(let i=0;i<120;i++)world.step();
  assert.ok(Math.abs(floating.bodies.get('/Body').body.translation().y-3)<1e-6);
  assert.ok(falling.bodies.get('/Body').body.translation().y<0);
  assert.equal(floating.bodies.get('/Body').body.isCcdEnabled(),false);assert.equal(falling.bodies.get('/Body').body.isCcdEnabled(),true);
 }finally{world.dispose();}
});
