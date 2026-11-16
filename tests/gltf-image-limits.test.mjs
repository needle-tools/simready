import test from 'node:test';
import assert from 'node:assert/strict';
import {limitImageRequests} from '../src/gltf/limitImages.js';
import {NeedleSimreadyLoaderPlugin} from '../src/gltf.js';

test('SimReady image loads bound Blob concurrency and retain arguments, context and results',async()=>{
 let active=0,peak=0;const marker={};
 const parser={json:{extensions:{NEEDLE_simready:{version:3}}},async loadImageSource(index,loader){
  assert.equal(this,parser);assert.equal(loader,marker);active++;peak=Math.max(peak,active);
  await new Promise(resolve=>setImmediate(resolve));active--;return index*3;
 }};
 new NeedleSimreadyLoaderPlugin(parser);new NeedleSimreadyLoaderPlugin(parser);
 assert.deepEqual(await Promise.all(Array.from({length:20},(_,i)=>parser.loadImageSource(i,marker))),Array.from({length:20},(_,i)=>i*3));
 assert.equal(peak,2);
});

test('failed image reads release waiting loads and retain the original rejection',async()=>{
 const failure=new Error('decode failed'),parser={async loadImageSource(index){if(index===0)throw failure;return index;}};
 limitImageRequests(parser);
 const results=await Promise.allSettled([0,1,2,3,4].map(i=>parser.loadImageSource(i)));
 assert.equal(results[0].reason,failure);assert.deepEqual(results.slice(1).map(r=>r.value),[1,2,3,4]);
});

test('non-SimReady imports and parsers without an image method retain their behavior',()=>{
 const loadImageSource=async()=>true,parser={json:{},loadImageSource};
 new NeedleSimreadyLoaderPlugin(parser);assert.equal(parser.loadImageSource,loadImageSource);
 assert.doesNotThrow(()=>limitImageRequests({}));
});
