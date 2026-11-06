import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,appendFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const engineTarball=process.env.SIMREADY_ENGINE_TARBALL;
const source=fileURLToPath(new URL('..',import.meta.url));
const output=await mkdtemp(join(tmpdir(),'needle-simready-packed-'));
function run(cwd,cmd,args){const r=spawnSync(cmd,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout;}
const enginePackage=engineTarball?JSON.parse(run(source,'tar',['-xOf',resolve(engineTarball),'package/package.json'])):null;
const pack=JSON.parse(run(source,'npm',['pack','--json','--pack-destination',output]))[0],tarball=join(output,pack.filename);
const result={version:pack.version,engineTarball,tarball,sha256:createHash('sha256').update(await readFile(tarball)).digest('hex'),source:run(source,'git',['rev-parse','HEAD']).trim(),consumer:join(output,'consumer')};
const root=result.consumer;await mkdir(root);
await writeFile(join(root,'package.json'),JSON.stringify({name:'simready-packed-consumer',private:true,type:'module',dependencies:{...(engineTarball?{'@needle-tools/engine':`file:${resolve(engineTarball)}`}:{ }),'@needle-tools/simready':`file:${tarball}`,three:enginePackage?.dependencies?.three||'0.185.1','@dimforge/rapier3d-compat':'0.21.0',vite:'8.1.0',typescript:'5.9.3','@types/three':'0.185.4'},overrides:{three:'$three'}}));
run(root,'npm',['install','--no-audit','--no-fund','--prefer-offline']);
assert.equal(await realpath(join(root,'node_modules/@needle-tools/simready')),join(await realpath(root),'node_modules/@needle-tools/simready'));
result.dependencies=run(root,'npm',['ls','three','@needle-tools/simready',...(engineTarball?['@needle-tools/engine']:[])]);
const probe=`import {createSimreadyExtension} from '@needle-tools/simready';
import {registerSimreadyLoader,toGltfPhysicsSnapshot} from '@needle-tools/simready/gltf';
import {createSimulationWorld} from '@needle-tools/simready/rapier';
import {encodeUsdJointMetadata,decodeUsdJointMetadata} from '@needle-tools/simready/usd';
import {createMechanism} from '@needle-tools/simready/kinematics';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import R from '@dimforge/rapier3d-compat';
const check=(value,message)=>{if(!value)throw new Error(message);};
export async function probe(){
 await R.init();
 const q=[0,0,0,1],snapshot={metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',bodies:[{path:'/Body',position:[0,3,0],rotation:q,scale:[1,1,1],mass:2,rigidBodyEnabled:true}],shapes:[{path:'/Shape',body:'/Body',type:'cube',halfExtents:[.5,.5,.5],position:[0,0,0],rotation:q}],joints:[],materials:[],groups:[],scenes:[],unsupported:[]};
 const mimic={joint:'/Input',multiplier:-2,offset:15};
 const metadata=encodeUsdJointMetadata({mimic},path=>'/Export'+path);
 const decoded=decodeUsdJointMetadata(Object.fromEntries(metadata.attributes.map(a=>[a.name,a.value])),Object.fromEntries(metadata.relationships.map(r=>[r.name,r.targets])));
 check(decoded.joint==='/Export/Input'&&decoded.multiplier===-2&&decoded.offset===15,'USD metadata lost coupling');
 const rotor={...snapshot,joints:[{path:'/Input',type:'revolute',body0:'',body1:'/Body',axis:'Z',localPos0:[0,3,0],localPos1:[0,0,0],localRot0:q,localRot1:q,limit:{lower:-7200,upper:7200}}]};
 const pose=await createMechanism({snapshot:rotor});
 try{check(Math.abs(pose.getJointValue('/Input'))<1e-6,'wide limits changed the resting turn');pose.setJointValue('/Input',1080);check(Math.abs(pose.getJointValue('/Input')-1080)<1e-6,'multi-turn pose lost rotations');}finally{pose.dispose();}
 const extension=createSimreadyExtension({snapshot:toGltfPhysicsSnapshot(snapshot),stageNode:0,bindings:[{node:1,path:'/Body'}]});
 const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{children:[1]},{translation:[0,3,0]}],extensionsUsed:['NEEDLE_simready'],extensionsRequired:['NEEDLE_simready'],extensions:{NEEDLE_simready:extension}};
 const result=await registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(json),'');
 const runtime=result.userData.simready;check(!runtime.handle,'glTF must not manufacture a USD handle');
 const mechanism=await runtime.createMechanism();mechanism.update(1/120);mechanism.dispose();
 const host=createSimulationWorld({rapier:R});
 try{
  const floor={...snapshot,bodies:[],shapes:[{path:'/Floor',type:'cube',body:'',position:[0,-.5,0],rotation:q,halfExtents:[5,.5,5]}]};
  await host.addAsset({snapshot:floor,id:'floor'});
  const a=await runtime.createSimulation({world:host,id:'a'});
  const b=await host.addAsset({snapshot,id:'b',position:[0,3,0]});
  for(let i=0;i<360;i++)host.step();
  const height=b.bodies.get('/Body').body.translation().y;
  check(Math.abs(height-1.5)<.05,'cross-asset contacts failed');a.dispose();
  for(let i=0;i<240;i++)host.step();check(Math.abs(b.bodies.get('/Body').body.translation().y-.5)<.04,'asset disposal broke the world');
  const external=new R.World({x:0,y:-9.81,z:0}),events=new R.EventQueue(false);
  const ground=external.createCollider(R.ColliderDesc.cuboid(10,.5,10).setTranslation(0,-.5,0));
  let extension,detached=0;
  const borrowed=createSimulationWorld({rapier:R,world:external,registerWorldExtension:value=>{extension=value;return()=>detached++;}});
  let borrowedHeight;
  try{
   const imported=await borrowed.addAsset({snapshot});
   for(let i=0;i<240;i++){external.step(events,extension.hooks);extension.afterStep();}
   borrowedHeight=imported.bodies.get('/Body').body.translation().y;
   check(Math.abs(borrowedHeight-.5)<.05,'borrowed world contacts failed');
   extension.dispose();check(ground.isValid()&&detached===1,'borrowed world lifetime failed');
   external.step(events);
  }finally{borrowed.dispose();events.free();external.free();}
  return {height,borrowedHeight,assets:host.assets.size,usdHandle:!!runtime.handle};
 }finally{host.dispose();}
}
`;
await writeFile(join(root,'probe.js'),probe);
await writeFile(join(root,'node.mjs'),"import {probe} from './probe.js';\nimport {createNeedleSimulationWorld} from '@needle-tools/simready/needle';\nif(typeof createNeedleSimulationWorld!=='function')throw new Error('Missing Needle entry point');\nimport {createRequire} from 'node:module';\nconst require=createRequire(import.meta.url);\ntry{require.resolve('@needle-tools/usd');throw new Error('Unexpected USD dependency');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}\nconsole.log(JSON.stringify(await probe()));\n");
result.node=JSON.parse(run(root,'node',['node.mjs']).trim());
await writeFile(join(root,'consumer.ts'),`import R from '@dimforge/rapier3d-compat';
import {createSimulationWorld} from '@needle-tools/simready/rapier';
import {encodeUsdJointMetadata,decodeUsdJointMetadata} from '@needle-tools/simready/usd';
import {createMechanism} from '@needle-tools/simready/kinematics';
import {registerSimreadyLoader,toGltfPhysicsSnapshot} from '@needle-tools/simready/gltf';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
const encoded=encodeUsdJointMetadata({mimic:{joint:'/Input',multiplier:2,offset:0}});
const decoded=decodeUsdJointMetadata({},{});void encoded;void decoded;
const host=createSimulationWorld({rapier:R});host.world.timestep=1/120;
const external=new R.World({x:0,y:-9.81,z:0});
const borrowed=createSimulationWorld({rapier:R,world:external,registerWorldExtension:extension=>{
 const hooks:import('@dimforge/rapier3d-compat').PhysicsHooks=extension.hooks;void hooks;return()=>{};
}});
borrowed.sync();borrowed.dispose();external.free();
const loader=registerSimreadyLoader(new GLTFLoader());void loader;host.dispose();
`);
run(root,'npx',['--no-install','tsc','--noEmit','--strict','--skipLibCheck','false','--module','NodeNext','--moduleResolution','NodeNext','--target','ES2022','--lib','ES2022,DOM,ESNext.Disposable','consumer.ts']);
if(engineTarball)await appendFile(join(root,'consumer.ts'),`
import {createNeedleSimulationWorld} from '@needle-tools/simready/needle';
declare const context:import('@needle-tools/engine').Context;
const needle=await createNeedleSimulationWorld({context});
const backend:string=needle.capabilities.backend;void backend;needle.dispose();
`);
if(engineTarball){
 const args=['--no-install','tsc','--noEmit','--strict','--module','ESNext','--moduleResolution','Bundler','--target','ES2022','--lib','ES2022,DOM,ESNext.Disposable','consumer.ts'];
 const check=spawnSync('npx',[...args,'--skipLibCheck','false'],{cwd:root,encoding:'utf8'});
 if(check.status!==0){
  const diagnostics=check.stdout+check.stderr;
  assert.ok(!/^(?:consumer\.ts|node_modules\/@needle-tools\/simready\/).*error TS/m.test(diagnostics),diagnostics);
  result.engineDeclarationDiagnostics=join(output,'engine-declarations.log');
  await writeFile(result.engineDeclarationDiagnostics,diagnostics);
  // Engine's unrelated ambient/dependency declarations are audited above;
  // the consumer still checks its imported public API under strict mode.
  run(root,'npx',[...args,'--skipLibCheck','true']);
 }
}
if(engineTarball)await writeFile(join(root,'needle-probe.js'),await readFile(new URL('./packed-needle-probe.js',import.meta.url),'utf8'));
await writeFile(join(root,'index.html'),'<script type="module">import {probe} from "./probe.js";window.packed=await probe();'+(engineTarball?'const {probeNeedle}=await import("./needle-probe.js");window.packed.needle=await probeNeedle();window.needleComplete=true;':'')+'</script>');
run(root,'npx',['--no-install','vite','build']);
const {preview}=await import(pathToFileURL(join(root,'node_modules/vite/dist/node/index.js')));
// Use the host checkout's browser tooling; it is never shipped in the package.
const {chromium}=await import('@playwright/test');
const server=await preview({root,preview:{port:0}}),browser=await chromium.launch({channel:'chrome'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>!!window.packed,null,{timeout:30000});
 if(engineTarball)await page.waitForFunction(()=>window.needleComplete,null,{timeout:30000});
 result.browser=await page.evaluate(()=>window.packed);assert.deepEqual(errors,[]);assert.equal(result.browser.usdHandle,false);
}finally{await browser.close();await server.close();}
await writeFile(join(output,'result.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
