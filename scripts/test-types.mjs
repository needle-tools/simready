import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,cp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const source=fileURLToPath(new URL('..',import.meta.url));
const output=await mkdtemp(join(tmpdir(),'simready-type-consumer-'));
function run(cwd,command,args){
 const result=spawnSync(command,args,{cwd,encoding:'utf8',maxBuffer:8*1024*1024});
 assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout;
}
const pack=JSON.parse(run(source,'npm',['pack','--ignore-scripts','--json','--pack-destination',output]))[0];
const consumer=join(output,'consumer');await mkdir(consumer);
await writeFile(join(consumer,'package.json'),JSON.stringify({private:true,type:'module',dependencies:{
 '@needle-tools/simready':`file:${join(output,pack.filename)}`,
 '@dimforge/rapier3d-compat':'0.21.0','rapier-legacy':'npm:@dimforge/rapier3d-compat@0.19.3',
 '@needle-tools/engine':'6.0.0-alpha.7',three:'0.185.1','@types/three':'0.185.4',typescript:'5.9.3',
},overrides:{three:'$three'}}));
run(consumer,'npm',['install','--ignore-scripts','--no-audit','--no-fund','--prefer-offline']);
await cp(join(source,'tests/types'),join(consumer,'tests'),{recursive:true});
const common=['--no-install','tsc','--noEmit','--strict','--target','ES2022','--lib','ES2022,DOM,ESNext.Disposable'];
run(consumer,'npx',[...common,'--module','NodeNext','--moduleResolution','NodeNext','--skipLibCheck','false','tests/consumer.ts']);
run(consumer,'npx',[...common,'--module','ESNext','--moduleResolution','Bundler','--skipLibCheck','false','tests/consumer.ts','tests/legacy.ts']);
const engineArgs=[...common,'--module','ESNext','--moduleResolution','Bundler','tests/needle.ts'];
const engine=spawnSync('npx',[...engineArgs,'--skipLibCheck','false'],{cwd:consumer,encoding:'utf8',maxBuffer:8*1024*1024});
if(engine.status!==0){
 const diagnostics=engine.stdout+engine.stderr;
 assert.ok(!/^(?:tests\/|node_modules\/@needle-tools\/simready\/).*error TS/m.test(diagnostics),diagnostics);
 await writeFile(join(output,'engine-declarations.log'),diagnostics);
 run(consumer,'npx',[...engineArgs,'--skipLibCheck','true']);
 console.log('Engine dependency declaration diagnostics: '+join(output,'engine-declarations.log'));
}
console.log('Packed consumer type checks passed: Rapier 0.21 (NodeNext/Bundler), Rapier 0.19 and Needle (Bundler).');
console.log('Artifacts: '+output);
