// @ts-check

/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('./index.js').PhysicsSnapshot} PhysicsSnapshot */
/** @typedef {import('./index.js').SimreadyMetadata} SimreadyMetadata */
/** @typedef {import('./index.js').PhysicsIssue} PhysicsIssue */
/** @typedef {import('./kinematics.js').Mechanism} Mechanism */
/** @typedef {import('./rapier-types.js').RigidBody} RigidBody */
/** @typedef {import('./rapier-types.js').World} World */
/** @typedef {import('./three.js').ObjectBinding} ObjectBinding */
/** @typedef {{readonly snapshot:PhysicsSnapshot,readonly usdMetadata:SimreadyMetadata,readonly root:Object3D,
 * readonly bindings:ObjectBinding[],readonly mappingIssues:PhysicsIssue[],
 * createMechanism(options?:Omit<import('./kinematics.js').MechanismOptions,'snapshot'|'bindVisuals'>):Promise<Mechanism&{root:Object3D}>,
 * createSimulation:CreateBoundSimulation}} SimreadyRuntime */
/** @typedef {<B extends RigidBody,W extends import('./rapier-types.js').World<B>>(options:
 * (Omit<import('./rapier.js').SimulationOptions<B,W>,'snapshot'>&{world?:never})|
 * ({world:import('./rapier.js').SimulationWorld<W,B>}&Omit<import('./rapier.js').WorldAssetOptions<B>,'snapshot'>))=>
 * Promise<import('./rapier.js').Simulation<W,B>&{root:Object3D}>} CreateBoundSimulation */
/** @typedef {{json:{extensions?:Record<string,unknown>,nodes?:unknown[],meshes?:{primitives:{mode?:number}[]}[]},
 * getDependency(type:string,index:number):Promise<unknown>}} SimreadyParser */
/** @typedef {{scene:Object3D,userData?:Record<string,unknown>}} SimreadyLoadResult */
/** @typedef {{register(factory:(parser:SimreadyParser)=>NeedleSimreadyLoaderPlugin):unknown}} SimreadyLoader */

import {SIMREADY_EXTENSION,encodeMetadata,createSimreadyExtension} from './index.js';
import {bindVisuals,placeAssetRoot,withVisualController} from './three.js';
export {SIMREADY_EXTENSION} from './index.js';
import {copyJson} from './json.js';
import {isRecord,isWireSnapshot,isArray,isBinding,isMetadata,isIssue} from './validation.js';
/** @param {unknown} value @returns {value is Object3D} */
const isObject3D=value=>isRecord(value)&&value.isObject3D===true;
/** @typedef {import('three').Mesh|import('three').Line|import('three').Points} CollisionPrimitive */
/** @param {Object3D} value @returns {value is CollisionPrimitive} */
const isCollisionPrimitive=value=>('isMesh' in value&&value.isMesh===true)
 ||('isLine' in value&&value.isLine===true)||('isPoints' in value&&value.isPoints===true);
/** @type {WeakMap<object,SimreadyRuntime>} */
const runtimes=new WeakMap();
/** Attach lazy simulation/interaction factories; loading never starts simulation. */
export class NeedleSimreadyLoaderPlugin{
 /** @param {SimreadyParser} parser */
 constructor(parser){this.parser=parser;this.name=SIMREADY_EXTENSION;}
 /** @param {SimreadyLoadResult} result */
 async afterRoot(result){
  const data=this.parser.json.extensions?.[SIMREADY_EXTENSION];if(!data)return;
  if(!isRecord(data))throw new Error('Invalid NEEDLE_simready payload.');
  if(data.version!==1)throw new Error('Unsupported NEEDLE_simready version: '+data.version);
  if(!isWireSnapshot(data.snapshot)||!isArray(data.bindings)||!data.bindings.every(isBinding)||!isMetadata(data.usdMetadata))throw new Error('Invalid NEEDLE_simready payload.');
  if(data.mappingIssues!==undefined&&(!isArray(data.mappingIssues)||!data.mappingIssues.every(isIssue)))throw new Error('Invalid NEEDLE_simready mapping issues.');
  if(data.source)throw new Error('Embedded USD source is not supported by the SimReady runtime contract.');
  const cloned=copyJson(data.snapshot);
  if(!isWireSnapshot(cloned))throw new Error('Invalid NEEDLE_simready snapshot.');
  /** @type {PhysicsSnapshot & {shapes:Array<import('./index.js').PhysicsShape & {mesh?:number}>}} */
  const snapshot=cloned;
  for(const shape of snapshot.shapes)if(shape.type==='mesh'){
   const definition=typeof shape.mesh==='number'&&Number.isInteger(shape.mesh)?this.parser.json.meshes?.[shape.mesh]:undefined;
   if(!definition?.primitives?.length||shape.points!==undefined||shape.indices!==undefined)throw new Error('Invalid SimReady collision mesh reference.');
   if(typeof shape.mesh!=='number')throw new Error('Invalid SimReady collision mesh reference.');
   const object=await this.parser.getDependency('mesh',shape.mesh);
   if(!isObject3D(object))throw new Error('Invalid SimReady collision mesh object.');
   /** @type {CollisionPrimitive[]} */
   const parts=[];
   object.traverse(child=>{if(isCollisionPrimitive(child))parts.push(child);});
   if(parts.length!==definition.primitives.length)throw new Error('Unsupported SimReady collision mesh layout.');
   const points=[],indices=[];
   for(let part=0;part<parts.length;part++){
    const geometry=parts[part].geometry,position=geometry.getAttribute('position'),mode=definition.primitives[part].mode??4;
    if(!position||position.itemSize!==3||geometry.morphAttributes.position?.length||!([4,5,6].includes(mode)||shape.approximation==='convexHull'))throw new Error('Unsupported SimReady collision mesh geometry.');
    const offset=points.length/3;
    for(let vertex=0;vertex<position.count;vertex++){
     const point=[position.getX(vertex),position.getY(vertex),position.getZ(vertex)];
     if(!point.every(Number.isFinite))throw new Error('Invalid SimReady collision mesh positions.');
     points.push(...point);
    }
    const indexAttribute=geometry.index;
    const source=indexAttribute?Array.from({length:indexAttribute.count},(_,index)=>indexAttribute.getX(index)):Array.from({length:position.count},(_,index)=>index);
    // GLTFLoader has already triangulated strips and fans, including winding.
    const triangles=[4,5,6].includes(mode);
    if(source.some(index=>!Number.isInteger(index)||index<0||index>=position.count)||triangles&&source.length%3)throw new Error('Invalid SimReady collision mesh indices.');
    if(triangles)for(const index of source)indices.push(index+offset);
   }
   shape.points=points;if(indices.length)shape.indices=indices;delete shape.mesh;
  }
  /** @param {number} index */
  const node=async index=>{if(!Number.isInteger(index)||!this.parser.json.nodes?.[index])throw new Error('Invalid NEEDLE_simready node reference.');const object=await this.parser.getDependency('node',index);if(!isObject3D(object))throw new Error('Invalid NEEDLE_simready node.');return object;};
  if(typeof data.stageNode!=='number')throw new Error('Invalid NEEDLE_simready stage node.');
  const root=await node(data.stageNode),nodes=new Set();
  for(const binding of data.bindings){
   if(typeof binding.path!=='string'||nodes.has(binding.node)||binding.body&&!data.snapshot.bodies.some(body=>body.path===binding.body))throw new Error('Invalid or duplicate SimReady binding identity.');
   nodes.add(binding.node);const object=await node(binding.node);
   object.userData.usdPath=binding.body?binding.body+'/__visual/'+binding.node:binding.path;
   object.userData.usdSourcePath=binding.path;
   object.userData.usdBodyPath=binding.body;
   if(binding.instance)object.userData.usdInstanceIdentity=copyJson(binding.instance);
  }
  const bindings=await Promise.all(data.bindings.map(async binding=>({object:await node(binding.node),body:binding.body||binding.path})));
  const ownedBindings=bindings.filter(binding=>snapshot.bodies.some(body=>body.path===binding.body));
  /** @param {boolean} worldSpace */
  const bind=worldSpace=>
   /** @param {ReadonlyMap<string,{data:import('./index.js').PhysicsBody,body:import('./kinematics.js').BodyPose}>} bodies
    * @param {(item:{path:string,type?:string},reason:string)=>void} _warn @param {AbortSignal} [signal] */
   (bodies,_warn,signal)=>{signal?.throwIfAborted();return bindVisuals({root,bodies,bindings:ownedBindings,worldSpace});};
  const metadata=encodeMetadata(data.usdMetadata),mappingIssues=copyJson(data.mappingIssues||[]);
  if(!isMetadata(metadata)||!isArray(mappingIssues)||!mappingIssues.every(isIssue))throw new Error('Invalid NEEDLE_simready metadata.');
  /** @param {Omit<import('./kinematics.js').MechanismOptions,'snapshot'|'bindVisuals'>} [options] */
  async function createBoundMechanism(options={}){return withVisualController(root,async()=>{
   const{createMechanism}=await import('./kinematics.js');
   return Object.assign(await createMechanism({...options,snapshot:structuredClone(snapshot),bindVisuals:bind(false)}),{root});
  });}
  /** @template {RigidBody} B
   * @template {import('./rapier-types.js').World<B>} W
   * @param {(Omit<import('./rapier.js').SimulationOptions<B,W>,'snapshot'> & {world?:never}) |
   * ({world:import('./rapier.js').SimulationWorld<W,B>} & Omit<import('./rapier.js').WorldAssetOptions<B>,'snapshot'>)} options
   * @returns {Promise<import('./rapier.js').Simulation<W,B> & {root:Object3D}>}
   */
  async function createBoundSimulation(options){return withVisualController(root,async()=>{
   if(options.world){
    const{world,...assetOptions}=options,placement=placeAssetRoot(root,snapshot,world,assetOptions);
    try{const simulation=await world.addAsset({...assetOptions,snapshot:structuredClone(snapshot),bindVisuals:bind(true)});
     const dispose=simulation.dispose;let disposed=false;simulation.dispose=()=>{if(disposed)return;disposed=true;try{dispose();}finally{placement.reset();}};return Object.assign(simulation,{root});
    }catch(error){placement.reset();throw error;}
   }
   const{createSimulation}=await import('./rapier.js');
   /** @type {import('./rapier.js').SimulationOptions<B,W>} */
   const simulationOptions={...options,snapshot:structuredClone(snapshot),bindVisuals:bind(false)};
   return Object.assign(await createSimulation(simulationOptions),{root});
  });}
  result.userData||={};
  const runtime={snapshot,usdMetadata:metadata,root,bindings:ownedBindings,mappingIssues,createMechanism:createBoundMechanism,createSimulation:createBoundSimulation};
  result.userData.simready=runtime;
  runtimes.set(result.scene,runtime);runtimes.set(result,runtime);runtimes.set(runtime,runtime);
 }
}
/** @type {WeakSet<SimreadyLoader>} */
const loaders=new WeakSet();
/** @template {SimreadyLoader} L @param {L} loader @returns {L} */
export function registerSimreadyLoader(loader){if(!loaders.has(loader)){loaders.add(loader);loader.register(parser=>new NeedleSimreadyLoaderPlugin(parser));}return loader;}
/** Find an activated glTF runtime inside a host's loaded scene. */
/** @param {unknown} asset @returns {SimreadyRuntime|null} */
export function getSimreadyRuntime(asset){
 if(!isRecord(asset))return null;
 const candidate=isRecord(asset.userData)?asset.userData.simready:null;
 let runtime=isRecord(candidate)?runtimes.get(candidate):undefined;
 runtime||=runtimes.get(asset);if(runtime)return runtime;
 const root=isObject3D(asset.scene)?asset.scene:isObject3D(asset)?asset:null;
 root?.traverse(object=>{runtime||=runtimes.get(object);});return runtime||null;
}
