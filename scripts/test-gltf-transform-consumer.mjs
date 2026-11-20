import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=resolve(import.meta.dirname,'..');
const run=(cwd,args)=>{
	const result=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,encoding:'utf8'});
	if(result.status!==0)throw Error(result.stdout+result.stderr);
	return result.stdout;
};
const temp=await mkdtemp(join(tmpdir(),'simready-gltf-transform-consumer-'));
try{
	const packed=JSON.parse(run(root,['pack','--pack-destination',temp,'--json']));
	const tarball=join(temp,packed[0].filename),digest=createHash('sha256').update(await readFile(tarball)).digest('hex');
	const results=[];
	for(const version of ['4.2.1','4.4.2']){
		const directory=join(temp,version);await mkdir(directory);
		await writeFile(join(directory,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{'@needle-tools/simready':'file:'+tarball,'@gltf-transform/core':version,three:'0.186.1'}}));
		run(directory,['install','--omit=dev']);
		const probe=`import assert from 'node:assert/strict';
import {Document,NodeIO} from '@gltf-transform/core';
import {createSimreadyRuntimeExtension} from '@needle-tools/simready';
import {registerSimreadyExtensions,NeedleSimreadyExtension,SimreadyData,NEEDLE_SIMREADY,PhysicsBodiesExtension,PhysicsData,PHYSICS_BODIES,retainCollisionGeometry,simulationResources} from '@needle-tools/simready/gltf-transform';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {getSimreadyRuntime,registerSimreadyLoader} from '@needle-tools/simready/gltf';
const document=new Document(),buffer=document.createBuffer(),mesh=document.createMesh().addPrimitive(document.createPrimitive().setAttribute('POSITION',document.createAccessor().setBuffer(buffer).setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0]))));
const stage=document.createNode('Stage'),body=document.createNode('Body').setMesh(mesh);stage.addChild(body);document.createScene().addChild(stage);
const payload=createSimreadyRuntimeExtension({stageNode:0,bindings:[{node:1,path:'/Body',body:'/Body'}],snapshot:{scenes:[],materials:[],groups:[],unsupported:[],joints:[],bodies:[{path:'/Body',position:[0,0,0],rotation:[0,0,0,1],mass:2}],shapes:[{path:'/Body/Collider',body:'/Body',type:'mesh',mesh:0,approximation:'convexHull'}]}});
document.createExtension(NeedleSimreadyExtension).setRequired(false);document.getRoot().setExtension(NEEDLE_SIMREADY,new SimreadyData(document.getGraph()).setPayload(payload).setReference('stageNode',stage).setReference('bindings.0.node',body).setMesh('snapshot.shapes.0.mesh',mesh));
document.createExtension(PhysicsBodiesExtension).setRequired(false);body.setExtension(PHYSICS_BODIES,new PhysicsData(document.getGraph()).setPayload({motion:{mass:2},collider:{geometry:{node:1,convexHull:true}}}).setReference('collider.geometry.node',body));
retainCollisionGeometry(document);const roles=simulationResources(document);assert.equal(roles.collisionMeshes.size,1);assert(roles.simulationNodes.has(body));
const io=registerSimreadyExtensions(new NodeIO()),bytes=await io.writeBinary(document),copy=await io.readBinary(bytes),data=copy.getRoot().getExtension(NEEDLE_SIMREADY);assert(data instanceof SimreadyData);assert.equal(data.getReference('bindings.0.node').getName(),'Body');
const asset=await registerSimreadyLoader(new GLTFLoader()).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');const runtime=getSimreadyRuntime(asset);assert(runtime);assert.equal(runtime.snapshot.bodies[0].mass,2);assert.equal(runtime.snapshot.shapes[0].points.length,9);
const json=(await io.writeJSON(copy)).json;assert(!json.extensionsRequired?.includes(NEEDLE_SIMREADY));assert(!json.extensionsRequired?.includes(PHYSICS_BODIES));console.log(JSON.stringify({bodies:runtime.snapshot.bodies.length,colliders:runtime.snapshot.shapes.length,optional:true}));`;
		await writeFile(join(directory,'probe.mjs'),probe);
		const proof=spawnSync(process.execPath,['probe.mjs'],{cwd:directory,encoding:'utf8'});
		if(proof.status!==0)throw Error(proof.stdout+proof.stderr);
		results.push({core:version,...JSON.parse(proof.stdout.trim())});
	}
	console.log(JSON.stringify({tarballSha256:digest,results}));
}finally{await rm(temp,{recursive:true,force:true});}
