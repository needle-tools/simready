import R, {type World, type RigidBody} from '@dimforge/rapier3d-compat';
import {type PhysicsSnapshot,createSimreadyExtension} from '@needle-tools/simready';
import {createSimulation,createSimulationWorld} from '@needle-tools/simready/rapier';
import {getSimreadyRuntime,registerSimreadyLoader} from '@needle-tools/simready/gltf';
import {createMechanism} from '@needle-tools/simready/kinematics';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// The descriptors from the README omit values which the adapters default.
const snapshot={
 metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',
 scenes:[],materials:[],groups:[],joints:[],unsupported:[],
 bodies:[{path:'/Box',position:[0,2,0],rotation:[0,0,0,1],mass:1,rigidBodyEnabled:true}],
 shapes:[{path:'/Box/Collider',body:'/Box',type:'cube',position:[0,0,0],rotation:[0,0,0,1],halfExtents:[.5,.5,.5]},
 {path:'/Floor',body:'',type:'cube',position:[0,-.5,0],rotation:[0,0,0,1],halfExtents:[5,.5,5]}],
} satisfies PhysicsSnapshot;
const {metersPerUnit,kilogramsPerUnit,upAxis,...wire}=snapshot;
createSimreadyExtension({snapshot:wire,stageNode:0,bindings:[{node:1,path:'/Box'}]});
const host=createSimulationWorld({rapier:R});
const world:World=host.world;
const attached=await host.addAsset({snapshot});
const body:RigidBody=attached.bodies.get('/Box')!.body;
body.invMass();world.timestep=1/120;
const direct=await createSimulation({rapier:R,snapshot,bindVisuals(bodies){
 const native:RigidBody=bodies.get('/Box')!.body;native.invMass();
 return {sync(){},reset(){},bodyForObject(){return null;}};
}});
const directWorld:World=direct.world;
const directBody:RigidBody=direct.bodies.get('/Box')!.body;
const loader=registerSimreadyLoader(new GLTFLoader());
const runtime=getSimreadyRuntime(await loader.loadAsync('/assembly.glb'))!;
const imported=await runtime.createSimulation({world:host});
const importedWorld:World=imported.world;
const importedBody:RigidBody=imported.bodies.get('/Box')!.body;
const standalone=await runtime.createSimulation({rapier:R});
const standaloneBody:RigidBody=standalone.bodies.get('/Box')!.body;
const standaloneWorld:World=standalone.world;
void [directBody,directWorld,importedBody,importedWorld,standaloneBody,standaloneWorld];
// The presence of a World constructor alone cannot satisfy the adapter protocol.
// @ts-expect-error missing descriptor factories, event queue and body protocol
createSimulationWorld({rapier:{World:class {}}});
const {EventQueue,...incomplete}=R;
// @ts-expect-error a simulation host needs the supplied module's event queue
createSimulationWorld({rapier:incomplete});
// @ts-expect-error dimensions are numeric tuples
snapshot.shapes.push({path:'/Bad',type:'cube',halfExtents:['wide',1,1]});

// These negative checks also catch accidental `any` in generated returns.
// @ts-expect-error Rapier bodies do not have arbitrary methods
importedBody.notAPhysicsMethod();
// @ts-expect-error native worlds do not accept arbitrary settings
importedWorld.notAWorldSetting=true;
const mechanism=await createMechanism({snapshot});
mechanism.update(1/120);
const joint=mechanism.jointForBody('/Box');
if(joint){
 const lower:number=joint.lower;void lower;
 // @ts-expect-error joint records have an explicit contract
 joint.notAJointSetting=true;
}

import {prepareUsdPhysicsSnapshot,encodeUsdJointMetadata} from '@needle-tools/simready/usd';
const planned=prepareUsdPhysicsSnapshot(snapshot);
const nativeMetadata=encodeUsdJointMetadata(planned.joints[0]);
const schemas:string[]=nativeMetadata.apiSchemas;
const synthetic:boolean|undefined=planned.bodies[0].usdSyntheticBase;
const articulationRoot:boolean|undefined=planned.joints[0].articulationRoot;
void [schemas,synthetic,articulationRoot];
// @ts-expect-error export markers are booleans
planned.joints[0].articulationRoot='yes';
