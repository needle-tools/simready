import {readFile,writeFile,readdir} from 'node:fs/promises';

// The JSON files are the editable sources. Each embeds one geometry buffer;
// the matching GLB packs those same bytes into a single downloadable file.
const directory=new URL('../extensions/NEEDLE_simready/examples/',import.meta.url);
for(const name of (await readdir(directory)).filter(name=>name.endsWith('.gltf'))){
 const json=JSON.parse(await readFile(new URL(name,directory),'utf8'));
 if(json.buffers?.length!==1||!json.buffers[0].uri?.startsWith('data:application/octet-stream;base64,'))throw new Error(`${name} must embed one geometry buffer.`);
 const binary=Buffer.from(json.buffers[0].uri.split(',')[1],'base64');
 if(binary.length!==json.buffers[0].byteLength)throw new Error(`${name} has an inconsistent buffer length.`);
 delete json.buffers[0].uri;
 const text=Buffer.from(JSON.stringify(json)),jsonLength=(text.length+3)&~3,binaryLength=(binary.length+3)&~3;
 const output=Buffer.alloc(12+8+jsonLength+8+binaryLength);
 output.writeUInt32LE(0x46546c67,0);output.writeUInt32LE(2,4);output.writeUInt32LE(output.length,8);
 output.writeUInt32LE(jsonLength,12);output.writeUInt32LE(0x4e4f534a,16);
 output.fill(0x20,20,20+jsonLength);text.copy(output,20);
 output.writeUInt32LE(binaryLength,20+jsonLength);output.writeUInt32LE(0x004e4942,24+jsonLength);binary.copy(output,28+jsonLength);
 const target=name.replace(/\.gltf$/,'.glb');await writeFile(new URL(target,directory),output);
 console.log(target);
}
