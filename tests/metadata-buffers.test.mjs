import assert from 'node:assert/strict';
import {test} from 'node:test';
import {NeedleSimreadyLoaderPlugin} from '../src/gltf.js';
import {Group} from 'three';
import {readFile,readdir} from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

const snapshot={scenes:[],bodies:[],shapes:[],joints:[],materials:[],groups:[]};
async function load(record,values=new Float32Array([1,2,3,4]),version=2){
 const root=new Group(),metadata={version:1,time:0,stage:{samples:null},prims:[]};
 const payload={version,stageNode:0,snapshot,bindings:[],usdMetadata:metadata,...(record?{metadataBuffers:[record]}:{})};
 const parser={json:{nodes:[{}],extensions:{NEEDLE_simready:payload}},async getDependency(type){return type==='node'?root:values.buffer;}};
 const result={scene:root};await new NeedleSimreadyLoaderPlugin(parser).afterRoot(result);return{result,payload};
}
const descriptor={path:['stage','samples'],bufferView:0,componentType:'float32',shape:[2,2]};

test('version 2 restores numeric metadata before exposing it and keeps the wire payload immutable',async()=>{
 const{result,payload}=await load(descriptor);
 assert.deepEqual(result.userData.simready.usdMetadata.stage.samples,[[1,2],[3,4]]);
 assert.equal(payload.usdMetadata.stage.samples,null);
});

test('buffered metadata rejects invalid bounds, precision declarations, paths and numeric values',async()=>{
 for(const record of [
  {...descriptor,bufferView:-1},{...descriptor,componentType:'float16'},
  {...descriptor,shape:[2,3]},{...descriptor,shape:[Number.MAX_SAFE_INTEGER,2]},
  {...descriptor,path:['__proto__','samples']},{...descriptor,path:['stage','missing']},
 ])await assert.rejects(load(record),/Invalid NEEDLE_simready metadata buffer/);
 await assert.rejects(load(descriptor,new Float32Array([1,2,NaN,4])),/metadata buffer value/);
 await assert.rejects(load(undefined),/metadata buffers/);
 await assert.rejects(load(descriptor,undefined,1),/metadata buffers/);
});

test('version 1 remains inline and requires no binary storage',async()=>{
 const{result}=await load(undefined,undefined,1);
 assert.equal(result.userData.simready.usdMetadata.stage.samples,null);
});

test('the strict schema accepts buffered metadata only with a version 2 storage description',async()=>{
 const spec=new URL('../extensions/NEEDLE_simready/schema/',import.meta.url),ajv=new Ajv2020({strict:true,allErrors:true});
 for(const file of await readdir(spec))ajv.addSchema(JSON.parse(await readFile(new URL(file,spec),'utf8')));
 const validate=ajv.getSchema(JSON.parse(await readFile(new URL('glTF.NEEDLE_simready.schema.json',spec),'utf8')).$id);
 const{payload}=await load(descriptor);assert.equal(validate(payload),true,JSON.stringify(validate.errors));
 assert.equal(validate({...payload,version:1}),false);
 const{metadataBuffers,...missing}=payload;assert.equal(validate(missing),false);
});
