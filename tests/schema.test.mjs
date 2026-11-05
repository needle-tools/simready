import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile,readdir} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import {Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSimreadyExtension} from '../src/index.js';
import {registerSimreadyLoader} from '../src/gltf.js';
import {validateString,validateBytes} from 'gltf-validator';

globalThis.ProgressEvent ||= class {};
const spec=new URL('../extensions/NEEDLE_simready/',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,spec),'utf8'));
const ajv=new Ajv2020({strict:true,allErrors:true});
for(const name of await readdir(new URL('schema/',spec)))ajv.addSchema(await json('schema/'+name));
const validate=ajv.getSchema((await json('schema/glTF.NEEDLE_simready.schema.json')).$id);
assert.ok(validate);
const examples=await Promise.all((await readdir(new URL('examples/',spec))).filter(name=>name.endsWith('.gltf')).map(async name=>({name,asset:await json('examples/'+name)})));
const panel=examples.find(example=>example.name==='hinged-panel.gltf').asset;
const clone=value=>structuredClone(value);
const payload=()=>clone(panel.extensions.NEEDLE_simready);
function valid(value){assert.equal(validate(value),true,JSON.stringify(validate.errors,null,2));}
function accessorValues(asset,index){
 const accessor=asset.accessors[index],view=asset.bufferViews[accessor.bufferView];
 const bytes=Buffer.from(asset.buffers[view.buffer].uri.split(',')[1],'base64');
 const offset=(view.byteOffset||0)+(accessor.byteOffset||0),count=accessor.count*(accessor.type==='VEC3'?3:1);
 const read=accessor.componentType===5126?i=>bytes.readFloatLE(offset+i*4):i=>bytes.readUInt16LE(offset+i*2);
 return Array.from({length:count},(_,index)=>read(index));
}

test('the schemas compile strictly and validate the complete extension examples',()=>{
 for(const{name,asset}of examples){
  const data=asset.extensions.NEEDLE_simready;valid(data);
  assert.deepEqual(createSimreadyExtension(data),data,name+' agrees with the writer');
 }
});

test('the examples also satisfy the glTF core validator',async()=>{
 for(const{name,asset}of examples){
  const result=await validateString(JSON.stringify(asset),{uri:name});
  assert.equal(result.issues.numErrors,0,JSON.stringify(result.issues.messages,null,2));
 }
});

test('GLB examples contain the same geometry and metadata as their editable JSON sources',async()=>{
 for(const{name,asset}of examples){
  const bytes=await readFile(new URL('examples/'+name.replace(/\.gltf$/,'.glb'),spec));
  const result=await validateBytes(bytes);assert.equal(result.issues.numErrors,0,JSON.stringify(result.issues.messages,null,2));
  const loaded=await registerSimreadyLoader(new GLTFLoader()).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const expected=clone(asset);delete expected.buffers[0].uri;
  assert.deepEqual(loaded.parser.json,expected);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),jsonLength=view.getUint32(12,true);
  const binary=new Uint8Array(bytes.buffer,bytes.byteOffset+28+jsonLength,asset.buffers[0].byteLength);
  assert.deepEqual(Buffer.from(binary),Buffer.from(asset.buffers[0].uri.split(',')[1],'base64'));
  const meshes=[];loaded.scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
  assert.ok(meshes.length>=2,name+' must have visible geometry');
  for(const mesh of meshes){assert.ok(mesh.geometry.getAttribute('position').count>0);assert.ok(mesh.geometry.getAttribute('normal'));}
 }
});

test('examples load and joint posing moves the bound panel in the authored frame',async()=>{
 for(const{name,asset}of examples){
  const loaded=await registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(asset),'');
  const runtime=loaded.userData.simready;
  const expected=clone(asset.extensions.NEEDLE_simready.snapshot);
  for(const shape of expected.shapes)if(shape.type==='mesh'){
   const primitive=asset.meshes[shape.mesh].primitives[0];
   shape.points=accessorValues(asset,primitive.attributes.POSITION);shape.indices=accessorValues(asset,primitive.indices);delete shape.mesh;
  }
  assert.deepEqual(runtime.snapshot,expected);
  assert.deepEqual(runtime.usdMetadata,asset.extensions.NEEDLE_simready.usdMetadata);
  if(name==='semantic-labels.gltf')continue;
  const visual=runtime.bindings.find(binding=>binding.body==='/Cabinet/Door'&&binding.object.isMesh).object;
  const before=visual.getWorldPosition(new Vector3());
  const mechanism=await runtime.createMechanism();
  try{
   assert.deepEqual(mechanism.unsupported,[]);
   assert.equal(mechanism.setJointValue('/Cabinet/Hinge',45),true);
   assert.ok(Math.abs(mechanism.getJointValue('/Cabinet/Hinge')-45)<1e-5);
   runtime.root.updateWorldMatrix(true,true);
   assert.ok(visual.getWorldPosition(new Vector3()).distanceTo(before)>.1);
  }finally{mechanism.dispose();}
 }
});

test('the schema rejects malformed versions, frames, wire geometry and semantic values',()=>{
 const cases=[
  data=>{data.version=2;},
  data=>{data.stageNode=-1;},
  data=>{data.bindings[0].node=.5;},
  data=>{data.snapshot.bodies[0].position=[1,2];},
  data=>{data.snapshot.bodies[0].rotation=[0,0,0,0];},
  data=>{data.snapshot.shapes[0].type='mesh';},
  data=>{data.snapshot.shapes[0].points=[0,0,0];},
  data=>{data.snapshot.shapes[0].indices=[0,1,2];},
  data=>{delete data.snapshot.shapes[0].halfExtents;},
  data=>{data.snapshot.shapes[0].halfExtents[0]=-1;},
  data=>{data.snapshot.bodies[0].diagonalInertia=[1,-1,1];},
  ...['sphere','capsule','cylinder','cone'].map(type=>data=>{data.snapshot.shapes[0].type=type;delete data.snapshot.shapes[0].radius;}),
  ...['capsule','cylinder','cone'].map(type=>data=>{Object.assign(data.snapshot.shapes[0],{type,radius:1});delete data.snapshot.shapes[0].halfHeight;}),
  data=>{data.snapshot.joints[0].drive={enabled:true,targetPosition:0};},
  data=>{data.usdMetadata.prims[0].attributes[0].samples=[{time:0}];},
  data=>{data.usdMetadata.stage.custom={nested:[{$usdInteger:'1.5'}]};},
  data=>{data.usdMetadata.stage.custom={nested:{$usdNumber:'infinite'}};},
  data=>{data.source={archive:'original.usdz'};},
 ];
 for(const mutate of cases){const data=payload();mutate(data);assert.equal(validate(data),false,mutate.toString());}
});

test('semantic tags, unknown source properties and optional defaults remain representable',()=>{
 const data=payload();data.additionalVendorField={label:'extension data'};
 data.usdMetadata.stage.customLayerData={nested:[{$usdNumber:'Infinity'},{$usdNumber:'-Infinity'},{$usdNumber:'NaN'},{$usdInteger:'18446744073709551615'},{$usdValue:'(0, 1, 2)'}]};
 data.snapshot.joints[0].type='vendor:futureJoint';
 data.snapshot.shapes[0].type='vendor:futureShape';
 data.snapshot.unsupported=[{path:'',reason:'Asset-wide diagnostic'}];
 valid(data);
 delete data.mappingIssues;valid(data);
});

test('writer and loader reject missing metadata values and invalid binding identities',async()=>{
 for(const mutate of [
  data=>{data.bindings[0].path='';},
  data=>{data.bindings[0].node=-1;},
  data=>{delete data.usdMetadata.prims[0].attributes[0].value;},
  data=>{data.usdMetadata.prims[0].attributes[0].samples=[{time:0}];},
 ]){
  const data=payload();mutate(data);
  assert.throws(()=>createSimreadyExtension(data),/Invalid/);
  const asset=clone(panel);asset.extensions.NEEDLE_simready=data;
  await assert.rejects(registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(asset),''),/Invalid/);
 }
});

test('wire data uses fixed glTF units and radian joint limits',()=>{
 const data=payload(),written=createSimreadyExtension(data);
 for(const key of ['metersPerUnit','kilogramsPerUnit','upAxis'])assert.equal(Object.hasOwn(written.snapshot,key),false);
 assert.ok(Math.abs(written.snapshot.joints[0].limit.upper-Math.PI/2)<1e-10);
});

test('the loader also checks semantic node and mesh references which JSON Schema cannot bound',async()=>{
 for(const mutate of [
  data=>{data.stageNode=999;},
  data=>{data.bindings[0].node=999;},
  data=>{data.bindings.push({...data.bindings[0]});},
  data=>{data.snapshot.shapes[1]={...data.snapshot.shapes[1],type:'mesh',mesh:999};},
 ]){
  const asset=clone(panel);mutate(asset.extensions.NEEDLE_simready);valid(asset.extensions.NEEDLE_simready);
  await assert.rejects(registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(asset),''),/Invalid|duplicate/);
 }
});
