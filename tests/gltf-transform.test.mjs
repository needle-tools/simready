import assert from 'node:assert/strict';
import {assertPhysicsSchemas} from './helpers/physics-schemas.mjs';
import {test} from 'node:test';
import {Document, NodeIO} from '@gltf-transform/core';
import {cloneDocument, prune, dedup} from '@gltf-transform/functions';
import {createSimreadyRuntimeExtension} from '../src/index.js';
import {registerSimreadyExtensions, retainCollisionGeometry, simulationResources, SimreadyData, PhysicsData, NEEDLE_SIMREADY, PHYSICS_BODIES, IMPLICIT_SHAPES} from '../src/gltf-transform/index.js';

const q=[0,0,0,1];
async function fixture(){
	const document=new Document(), buffer=document.createBuffer();
	document.createNode('Unreferenced');
	const positions=new Float32Array([31.12345,2.98765,-7.3333,36.54321,2.98765,-7.3333,31.12345,8.12345,-7.3333]);
	const indices=new Uint16Array([0,1,2]);
	const mesh=document.createMesh('Visual').addPrimitive(document.createPrimitive()
		.setAttribute('POSITION',document.createAccessor().setType('VEC3').setBuffer(buffer).setArray(positions))
		.setIndices(document.createAccessor().setType('SCALAR').setBuffer(buffer).setArray(indices))
		.setMaterial(document.createMaterial().setBaseColorFactor([.2,.4,.6,1])));
	const stage=document.createNode('Stage').setScale([2,3,4]).setRotation([0,Math.sin(.2),0,Math.cos(.2)]);
	const body=document.createNode('Body').setMesh(mesh).setTranslation([2,0,1]);
	const tip=document.createNode('Tip').setTranslation([0,1,0]);
	stage.addChild(body).addChild(tip);document.createScene().addChild(stage);
	const io=registerSimreadyExtensions(new NodeIO()), input=await io.writeJSON(document);
	const node=name=>input.json.nodes.findIndex(node=>node.name===name);
	input.json.extensionsUsed=[NEEDLE_SIMREADY,PHYSICS_BODIES,IMPLICIT_SHAPES];
	input.json.extensions={
		[NEEDLE_SIMREADY]:createSimreadyRuntimeExtension({stageNode:node('Stage'),bindings:[{node:node('Body'),path:'/Body',body:'/Body'},{node:node('Tip'),path:'/Tip',body:'/Tip'}],snapshot:{scenes:[],materials:[],groups:[],unsupported:[],bodies:[{path:'/Body',position:[2,0,1],rotation:q,mass:3},{path:'/Tip',position:[0,1,0],rotation:q,mass:1}],shapes:[{path:'/Body/Collider',type:'mesh',body:'/Body',mesh:0,position:[0,0,0],rotation:q,approximation:'sdf'}],joints:[]},semantics:[{path:'/Body',taxonomy:'class',labels:['fixture']}] }),
		[PHYSICS_BODIES]:{physicsMaterials:[{staticFriction:.6,dynamicFriction:.4,restitution:.1}],physicsJoints:[{limits:[{angularAxes:[1],min:0,max:Math.PI/2}]}]},
		[IMPLICIT_SHAPES]:{shapes:[{type:'box',box:{size:[1,2,3]}}]},
	};
	input.json.extensions[NEEDLE_SIMREADY].extras={fixture:'hinge'};
	input.json.nodes[node('Body')].extensions={[PHYSICS_BODIES]:{motion:{mass:3},collider:{geometry:{mesh:0},physicsMaterial:0},trigger:{geometry:{shape:0}},joint:{connectedNode:node('Tip'),joint:0,enableCollision:false}}};
	input.json.nodes[node('Tip')].extensions={[PHYSICS_BODIES]:{motion:{mass:1},collider:{geometry:{node:node('Body')}}}};
	const accessor=input.json.accessors[input.json.meshes[0].primitives[0].attributes.POSITION];
	input.json.nodes[node('Body')].extras={collisionHulls:{bufferView:accessor.bufferView,byteOffset:accessor.byteOffset??0,counts:[3],materials:[0]}};
	return{io,input,document:await io.readJSON(input),positions,indices};
}

function runtime(document){
	const data=document.getRoot().getExtension(NEEDLE_SIMREADY);
	assert.ok(data instanceof SimreadyData);return data;
}

test('shared adapters retain simulation references, hull bytes and optional declarations across cloning and pruning',async()=>{
	const{io,document}=await fixture();
	const body=document.getRoot().listNodes().find(node=>node.getName()==='Body');
	const physics=body.getExtension(PHYSICS_BODIES);assert.ok(physics instanceof PhysicsData);
	const hull=physics.getHullBytes().slice();
	retainCollisionGeometry(document);
	const before=runtime(document),collision=before.getMesh('snapshot.shapes.0.mesh');
	const copy=cloneDocument(document);await copy.transform(prune(),dedup());
	const after=await io.readBinary(await io.writeBinary(copy));
	const restored=runtime(after),restoredBody=after.getRoot().listNodes().find(node=>node.getName()==='Body');
	const restoredPhysics=restoredBody.getExtension(PHYSICS_BODIES);
	assert.ok(restoredPhysics instanceof PhysicsData);
	assert.equal(restoredPhysics.getReference('joint.connectedNode').getName(),'Tip');
	assert.equal(restoredPhysics.getReference('collider.geometry.node').getMesh(),restored.getMesh('snapshot.shapes.0.mesh'));
	assert.deepEqual(restoredPhysics.getHullBytes(),hull);
	assert.deepEqual(restored.getPayload().extras,{fixture:'hinge'});
	assert.deepEqual(restored.getPayload().semantics,before.getPayload().semantics);
	assert.deepEqual(restored.getMesh('snapshot.shapes.0.mesh').listPrimitives()[0].getAttribute('POSITION').getArray(),collision.listPrimitives()[0].getAttribute('POSITION').getArray());
	const json=(await io.writeJSON(after)).json;
	assertPhysicsSchemas(json);
	for(const name of[NEEDLE_SIMREADY,PHYSICS_BODIES,IMPLICIT_SHAPES])assert.ok(!json.extensionsRequired?.includes(name));
	assert.equal(json.nodes[json.extensions[NEEDLE_SIMREADY].stageNode].name,'Stage');
	assert.deepEqual(json.extensions[IMPLICIT_SHAPES],{shapes:[{type:'box',box:{size:[1,2,3]}}]});
});

test('collider preparation is idempotent and keeps the full scaled and rotated frame chain',async()=>{
	const{document,positions}=await fixture();
	const body=document.getRoot().listNodes().find(node=>node.getName()==='Body'),original=body.getMesh();
	retainCollisionGeometry(document);
	const data=runtime(document),collision=data.getMesh('snapshot.shapes.0.mesh'),resources=simulationResources(document);
	assert.notEqual(collision,original);assert.ok(resources.collisionMeshes.has(collision));assert.ok(!resources.collisionMeshes.has(original));assert.ok(resources.simulationNodes.has(body));
	const tip=document.getRoot().listNodes().find(node=>node.getName()==='Tip');
	const frame=tip.getExtension(PHYSICS_BODIES).getReference('collider.geometry.node');
	assert.deepEqual(frame.getWorldMatrix(),body.getWorldMatrix());
	original.listPrimitives()[0].setAttribute('POSITION',document.createAccessor().setType('VEC3').setBuffer(document.getRoot().listBuffers()[0]).setArray(new Float32Array(9)));
	assert.deepEqual(collision.listPrimitives()[0].getAttribute('POSITION').getArray(),positions);
	retainCollisionGeometry(document);assert.equal(data.getMesh('snapshot.shapes.0.mesh'),collision);
	assert.deepEqual(collision.listPrimitives()[0].listSemantics(),['POSITION']);assert.equal(collision.listPrimitives()[0].getMaterial(),null);
});

test('shared adapters reject invalid input references and required targets deleted by an operation',async()=>{
	const{io,input,document}=await fixture();
	const body=input.json.nodes.find(node=>node.name==='Body');body.extensions[PHYSICS_BODIES].joint.connectedNode=9999;
	await assert.rejects(io.readJSON(input),/connectedNode/);
	runtime(document).getReference('bindings.1.node').dispose();
	await assert.rejects(io.writeBinary(document),/removed/);
});

test('keeps detached collider geometry separate from selected visual meshes',async()=>{
	const {document}=await fixture();
	const body=document.getRoot().listNodes().find(node=>node.getName()==='Body');
	const visual=body.getMesh();
	const detached=document.createNode('Collider').setMesh(visual);
	const physics=body.getExtension(PHYSICS_BODIES);
	physics.setReference('trigger.geometry.node',detached);
	const selected=retainCollisionGeometry(document);
	assert.ok(selected.has(visual));
	assert.ok(!selected.has(detached.getMesh()));
	assert.notEqual(detached.getMesh(),visual);
	assert.equal(detached.getMesh().listPrimitives()[0].getAttribute('POSITION'),visual.listPrimitives()[0].getAttribute('POSITION'));
});

test('compound triggers follow their child triggers through reorder, clone and serialization', async () => {
	const io = registerSimreadyExtensions(new NodeIO());
	const trigger = data => ({extensions: {[PHYSICS_BODIES]: {trigger: data}}});
	const input = {json: {asset: {version: '2.0'}, extensionsUsed: [PHYSICS_BODIES, IMPLICIT_SHAPES],
		extensions: {[IMPLICIT_SHAPES]: {shapes: [{type: 'sphere'}]}}, scenes: [{nodes: [1]}],
		nodes: [{}, {...trigger({nodes: [3, 2]}), name: 'owner', children: [2, 3]},
			{...trigger({geometry: {shape: 0}}), name: 'left'}, {...trigger({geometry: {shape: 0}}), name: 'right'}]}, resources: {}};
	const document = await io.readJSON(input);
	document.getRoot().listNodes()[0].dispose();
	const copy = cloneDocument(document);
	const {json} = await io.writeJSON(copy);
	assertPhysicsSchemas(json);
	const members = json.nodes[0].extensions[PHYSICS_BODIES].trigger.nodes;
	assert.deepEqual(members.map(i => json.nodes[i].name), ['right', 'left']);
	const left = copy.getRoot().listNodes().find(node => node.getName() === 'left');
	left.dispose();
	await assert.rejects(io.writeJSON(copy), /trigger.nodes.1.*removed/);
	for (const nodes of [[-1], [99], [0], [2, 2], []]) {
		input.json.nodes[1].extensions[PHYSICS_BODIES].trigger.nodes = nodes;
		await assert.rejects(io.readJSON(input), /trigger.nodes/);
	}
});

test('a visible collision node with its own mesh and child mesh keeps both collision surfaces', async () => {
	const {io, input} = await fixture();
	const body = input.json.nodes.find(node => node.name === 'Body');
	const child = input.json.nodes.push({mesh: 0, translation: [4, 0, 0]}) - 1;
	body.children = [child];
	const document = await io.readJSON(input);
	const tip = document.getRoot().listNodes().find(node => node.getName() === 'Tip');
	const geometry = tip.getExtension(PHYSICS_BODIES);
	const target = geometry.getReference('collider.geometry.node');
	const selected = retainCollisionGeometry(document);
	assert.equal(geometry.getReference('collider.geometry.node'), target);
	assert.equal(selected.has(target.getMesh()), false);
	assert.deepEqual(target.listChildren()[0].getTranslation(), [4, 0, 0]);
	const {json} = await io.writeJSON(document);
	const ref = json.nodes.find(n => n.name === 'Tip').extensions[PHYSICS_BODIES].collider.geometry.node;
	assert.ok(json.meshes[json.nodes[ref].mesh]);
	assert.ok(json.meshes[json.nodes[json.nodes[ref].children[0]].mesh]);
});

test('freshly authored physics must attach collider geometry by node or shape', async () => {
	const {io, document} = await fixture();
	const body = document.getRoot().listNodes().find(node => node.getName() === 'Body');
	const physics = body.getExtension(PHYSICS_BODIES);
	physics.setPayload({collider: {geometry: {mesh: 0}}});
	await assert.rejects(io.writeJSON(document), /collider.geometry: expected exactly one node or shape/);
});
