import {SIMREADY_EXTENSION,encodeMetadata,createSimreadyExtension} from './index.js';
import {bindVisuals,placeAssetRoot,withVisualController} from './three.js';
export {SIMREADY_EXTENSION} from './index.js';
const plain=value=>JSON.parse(JSON.stringify(value,(_key,item)=>ArrayBuffer.isView(item)?Array.from(item):item));
const runtimes=new WeakMap();
/** Attach lazy simulation/interaction factories; loading never starts simulation. */
export class NeedleSimreadyLoaderPlugin{
 constructor(parser){this.parser=parser;this.name=SIMREADY_EXTENSION;}
 async afterRoot(result){
  const data=this.parser.json.extensions?.[SIMREADY_EXTENSION];if(!data)return;
  if(data.version!==1)throw new Error('Unsupported NEEDLE_simready version: '+data.version);
  if(!data.snapshot||!['bodies','shapes','joints','materials','groups','scenes'].every(key=>Array.isArray(data.snapshot[key]))||!Array.isArray(data.bindings)||data.usdMetadata?.version!==1||!Array.isArray(data.usdMetadata.prims))throw new Error('Invalid NEEDLE_simready payload.');
  if(data.source)throw new Error('Embedded USD source is not supported by the SimReady runtime contract.');
  const snapshot=plain(data.snapshot);
  for(const shape of snapshot.shapes)if(shape.type==='mesh'){
   const definition=Number.isInteger(shape.mesh)&&this.parser.json.meshes?.[shape.mesh];
   if(!definition?.primitives?.length||shape.points!==undefined||shape.indices!==undefined)throw new Error('Invalid SimReady collision mesh reference.');
   const object=await this.parser.getDependency('mesh',shape.mesh),parts=[];
   object.traverse(child=>{if(child.geometry)parts.push(child);});
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
    const source=geometry.index?Array.from({length:geometry.index.count},(_,index)=>geometry.index.getX(index)):Array.from({length:position.count},(_,index)=>index);
    // GLTFLoader has already triangulated strips and fans, including winding.
    const triangles=[4,5,6].includes(mode);
    if(source.some(index=>!Number.isInteger(index)||index<0||index>=position.count)||triangles&&source.length%3)throw new Error('Invalid SimReady collision mesh indices.');
    if(triangles)for(const index of source)indices.push(index+offset);
   }
   shape.points=points;if(indices.length)shape.indices=indices;delete shape.mesh;
  }
  const node=async index=>{if(!Number.isInteger(index)||!this.parser.json.nodes?.[index])throw new Error('Invalid NEEDLE_simready node reference.');return this.parser.getDependency('node',index);};
  const root=await node(data.stageNode),nodes=new Set();
  for(const binding of data.bindings){
   if(typeof binding.path!=='string'||nodes.has(binding.node)||binding.body&&!data.snapshot.bodies.some(body=>body.path===binding.body))throw new Error('Invalid or duplicate SimReady binding identity.');
   nodes.add(binding.node);const object=await node(binding.node);
   object.userData.usdPath=binding.body?binding.body+'/__visual/'+binding.node:binding.path;
   object.userData.usdSourcePath=binding.path;
   object.userData.usdBodyPath=binding.body;
   if(binding.instance)object.userData.usdInstanceIdentity=plain(binding.instance);
  }
  const bindings=await Promise.all(data.bindings.map(async binding=>({object:await node(binding.node),body:binding.body||binding.path})));
  const ownedBindings=bindings.filter(binding=>snapshot.bodies.some(body=>body.path===binding.body));
  const bind=worldSpace=>(bodies,_warn,signal)=>{signal?.throwIfAborted();return bindVisuals({root,bodies,bindings:ownedBindings,worldSpace});};
  result.userData||={};
  result.userData.simready={snapshot,usdMetadata:encodeMetadata(data.usdMetadata),root,bindings:ownedBindings,mappingIssues:plain(data.mappingIssues||[]),
   async createMechanism(options={}){return withVisualController(root,async()=>{const{createMechanism}=await import('./kinematics.js');return Object.assign(await createMechanism({...options,snapshot:structuredClone(snapshot),bindVisuals:bind(false)}),{root});});},
   async createSimulation({world,...options}={}){return withVisualController(root,async()=>{
    if(world){
     const placement=placeAssetRoot(root,snapshot,world,options);
     try{const simulation=await world.addAsset({...options,snapshot:structuredClone(snapshot),bindVisuals:bind(true)});
      const dispose=simulation.dispose;let disposed=false;simulation.dispose=()=>{if(disposed)return;disposed=true;try{dispose();}finally{placement.reset();}};return Object.assign(simulation,{root});
     }catch(error){placement.reset();throw error;}
    }
    const{createSimulation}=await import('./rapier.js');return Object.assign(await createSimulation({...options,snapshot:structuredClone(snapshot),bindVisuals:bind(false)}),{root});
   });},
  };
  runtimes.set(result.scene,result.userData.simready);
 }
}
const loaders=new WeakSet();
export function registerSimreadyLoader(loader){if(!loaders.has(loader)){loaders.add(loader);loader.register(parser=>new NeedleSimreadyLoaderPlugin(parser));}return loader;}
/** Find an activated glTF runtime inside a host's loaded scene. */
export function getSimreadyRuntime(asset){
 let runtime=asset?.userData?.simready||runtimes.get(asset);if(runtime)return runtime;
 const root=asset?.scene||asset;root?.traverse?.(object=>{runtime||=runtimes.get(object);});return runtime||null;
}
