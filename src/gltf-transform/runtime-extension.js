// @ts-check
import {Extension,ExtensionProperty,PropertyType,RefMap} from '@gltf-transform/core';
import {createSimreadyRuntimeExtension,validateSimreadyExtension} from '../index.js';
export const NEEDLE_SIMREADY='NEEDLE_simready';
/** @typedef {import('@gltf-transform/core').IProperty & {payload:Record<string,any>, references:import('@gltf-transform/core').RefMap<import('@gltf-transform/core').Node>,meshes:import('@gltf-transform/core').RefMap<import('@gltf-transform/core').Mesh>}} SimreadyProperties */
/** @extends {ExtensionProperty<SimreadyProperties>} */
// @ts-ignore -- glTF Transform's public base type leaks property-graph in declaration emit.
export class SimreadyData extends ExtensionProperty{
 static EXTENSION_NAME=NEEDLE_SIMREADY;
 extensionName=NEEDLE_SIMREADY;
 propertyType='SimreadyData';parentTypes=[PropertyType.ROOT];
 init(){}
 /** @returns {import('@gltf-transform/core').Nullable<SimreadyProperties>} */
 getDefaults(){return{...super.getDefaults(),payload:{},references:new RefMap(),meshes:new RefMap()};}
 getPayload(){return this.get('payload');}
 /** @param {Record<string,any>} value */
 setPayload(value){return this.set('payload',structuredClone(value));}
 /** @param {string} key @param {import('@gltf-transform/core').Node} node */
 setReference(key,node){return this.setRefMap('references',key,node);}
 /** @param {string} key */
 getReference(key){return this.getRefMap('references',key);}
 referencePaths(){return this.listRefMapKeys('references');}
 /** @param {string} key @param {import('@gltf-transform/core').Mesh} mesh */
 setMesh(key,mesh){return this.setRefMap('meshes',key,mesh);}
 /** @param {string} key */
 getMesh(key){return this.getRefMap('meshes',key);}
 meshPaths(){return this.listRefMapKeys('meshes');}

}
export class NeedleSimreadyExtension extends Extension{
 static EXTENSION_NAME=NEEDLE_SIMREADY;extensionName=NEEDLE_SIMREADY;
 /** @param {import('@gltf-transform/core').ReaderContext} context */
 read(context){
  const json=context.jsonDoc.json,payload=/** @type {Record<string,any>|undefined} */(json.extensions?.[NEEDLE_SIMREADY]);if(!payload)return this;
  validateSimreadyExtension(payload);
  const data=new SimreadyData(this.document.getGraph()).setPayload(payload);
  const refs=[['stageNode',payload.stageNode],...payload.bindings.map((/** @type {any} */ item,/** @type {number} */ index)=>[`bindings.${index}.node`,item.node])];
  for(const [key,index]of refs){if(!Number.isInteger(index)||!context.nodes[index])throw new Error('Invalid NEEDLE_simready node reference.');data.setReference(key,context.nodes[index]);}
  for(const path of colliderMeshes(payload)){
   const index=at(payload,path);if(!Number.isInteger(index)||!context.meshes[index])throw new Error('Invalid SimReady collision mesh reference.');
   data.setMesh(path,context.meshes[index]);
  }
  this.document.getRoot().setExtension(NEEDLE_SIMREADY,data);return this;
 }
 /** @param {import('@gltf-transform/core').WriterContext} context */
 write(context){
  const data=this.document.getRoot().getExtension(NEEDLE_SIMREADY);if(!(data instanceof SimreadyData))return this;
  const payload=structuredClone(data.getPayload());
  // Disposing a graph node removes its incoming edges too. Enumerate the
  // contract's required fields so that cannot resurrect stale input indices.
  const paths=['stageNode',...payload.bindings.map((/** @type {any} */ _item,/** @type {number} */ index)=>`bindings.${index}.node`)];
  for(const path of paths){
   const node=data.getReference(path),index=node&&context.nodeIndexMap.get(node);if(index===undefined||index===null)throw new Error('SimReady runtime binding was removed during optimization.');
   const keys=path.split('.');let target=payload;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)??'']=index;
  }
  for(const path of colliderMeshes(payload)){
   const mesh=data.getMesh(path),index=mesh&&context.meshIndexMap.get(mesh);
   if(index===undefined||index===null)throw new Error('SimReady collision mesh was removed during optimization.');
   const keys=path.split('.');let target=payload;for(const key of keys.slice(0,-1))target=target[key];target[keys.at(-1)??'']=index;
  }
  (context.jsonDoc.json.extensions??={})[NEEDLE_SIMREADY]=createSimreadyRuntimeExtension({snapshot:payload.snapshot,stageNode:payload.stageNode,bindings:payload.bindings,semantics:payload.semantics,mappingIssues:payload.mappingIssues});return this;
 }
}
/** @param {Record<string,any>} payload @returns {string[]} */
function colliderMeshes(payload){return(payload.snapshot.shapes??[]).flatMap((/** @type {any} */ shape,/** @type {number} */ index)=>{
 if(shape.type!=='mesh')return[];
 if(shape.points!==undefined||shape.indices!==undefined)throw new Error('SimReady mesh colliders must reference an ordinary glTF mesh.');
 return[`snapshot.shapes.${index}.mesh`];
});}
/** @param {Record<string,any>} payload @param {string} path @returns {any} */
function at(payload,path){let value=payload;for(const key of path.split('.'))value=value[key];return value;}
