import * as Engine from '@needle-tools/engine';
import {Object3D, Vector3} from 'three';
import {createNeedleSimulationWorld} from '@needle-tools/simready/needle';
import {bindVisuals} from '@needle-tools/simready/three';
const check=(condition,message)=>{if(!condition)throw new Error(message);};
export async function probeNeedle(){
 const context={isContext:true,time:{frame:0},scene:new Object3D(),stopAllCoroutinesFrom(){},registerCoroutine(){},unregisterCoroutine(){},
  new_scripts:[],new_script_start:[],scripts:[],scripts_earlyUpdate:[],scripts_update:[],scripts_lateUpdate:[],scripts_onBeforeRender:[],scripts_onAfterRender:[],scripts_pausedChanged:[],new_scripts_xr:[],scripts_immersive_vr:[],scripts_immersive_ar:[]};
 context.physics=new Engine.Physics(context);
 const host=await createNeedleSimulationWorld({context}),physics=context.physics.engine,R=Engine.NEEDLE_ENGINE_MODULES.RAPIER_PHYSICS.MODULE;
 const floor=new Object3D(),object=new Object3D();context.scene.add(floor,object);floor.position.y=-.5;object.position.y=3;context.scene.updateMatrixWorld(true);
 let contacts=0;
 floor.userData.components=[{isComponent:true,gameObject:floor,onCollisionEnter(){contacts++;}}];
 const normal={gameObject:floor,isCollider:true,isTrigger:false,attachedRigidbody:null};
 const ground=physics.createCollider(normal,R.ColliderDesc.cuboid(5,.5,5).setTranslation(0,-.5,0));
 const q=[0,0,0,1],snapshot={metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',bodies:[{path:'/Body',position:[0,3,0],rotation:q,mass:2}],shapes:[{path:'/Shape',body:'/Body',type:'cube',halfExtents:[.5,.5,.5],position:[0,0,0],rotation:q}],joints:[],materials:[],groups:[],scenes:[],unsupported:[]};
 try{
  const asset=await host.addAsset({snapshot,bindVisuals:bodies=>bindVisuals({root:context.scene,bodies,bindings:[{body:'/Body',object}],worldSpace:true})});
  const body=asset.bodies.get('/Body').body,component=asset.rigidbodies.get('/Body'),collider=asset.colliderComponents.get(asset.bodies.get('/Body').colliders[0].handle);
  check(Engine.getComponent(object,Engine.Rigidbody)===component,'Engine body lookup failed');
  asset.play();body.setLinvel({x:0,y:-1,z:0},true);asset.pause();
  check(asset.bodyForObject(object)===asset.bodies.get('/Body'),'paused render object lost body identity');
  component.drag=.5;component.updateProperties();
  for(let i=0;i<30;i++){physics.step(1/60);physics.postStep();}
  check(Math.abs(body.translation().y-3)<1e-6,'Engine property update or world step thawed paused asset');
  check(physics.raycast(new Vector3(0,5,0),new Vector3(0,-1,0)).collider===collider,'paused collider lost query identity');
  asset.play();check(Math.abs(body.linvel().y+1)<1e-6,'play did not restore paused velocity');
  for(let i=0;i<240;i++){physics.step(1/60);physics.postStep();}
  check(Math.abs(body.translation().y-.5)<.04,'imported body did not contact Engine floor');
  check(contacts>0,'ordinary Engine object did not receive imported contacts');
  check(physics.raycast(new Vector3(0,3,0),new Vector3(0,-1,0)).collider===collider,'physics raycast lost imported identity');
  check(physics.sphereOverlap(new Vector3(0,.5,0),1).some(hit=>hit.collider===collider),'sphere overlap lost imported identity');
  check(physics.boxOverlap(new Vector3(0,.5,0),new Vector3(2,2,2)).some(hit=>hit.collider===collider),'box overlap lost imported identity');
  component.drag=.5;component.updateProperties();check(Math.abs(body.mass()-2)<.001,'Engine update overwrote imported mass');
  asset.reset();check(asset.rigidbodies.get('/Body')===component,'reset replaced Engine identity');
  asset.dispose();check(ground.isValid(),'asset disposal removed ordinary floor');check(Engine.getComponent(object,Engine.Rigidbody)===null,'asset disposal leaked Engine identity');
  return {contacts,queries:true,mass:2,pause:true,reset:true,disposal:true};
 }finally{host.dispose();physics.dispose();}
}
