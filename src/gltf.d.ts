import type {Object3D} from 'three';
import type {PhysicsSnapshot,SimreadyMetadata,PhysicsIssue} from './index.js';
import type {Mechanism} from './kinematics.js';
import type {Simulation,SimulationOptions,SimulationWorld,WorldAssetOptions} from './rapier.js';
import type {ObjectBinding} from './three.js';
export {SIMREADY_EXTENSION} from './index.js';
export interface SimreadyRuntime {
 readonly snapshot:PhysicsSnapshot;readonly usdMetadata:SimreadyMetadata;readonly root:Object3D;readonly bindings:ObjectBinding[];readonly mappingIssues:PhysicsIssue[];
 createMechanism(options?:{loadKinematics?:()=>Promise<unknown>}):Promise<Mechanism&{root:Object3D}>;
 createSimulation(options:Omit<SimulationOptions,'snapshot'>|({world:SimulationWorld}&Omit<WorldAssetOptions,'snapshot'>)):Promise<Simulation&{root:Object3D}>;
}
/** Only the parser methods the extension needs; compatible across Three versions. */
export interface SimreadyParser {json:{extensions?:Record<string,unknown>};getDependency(type:string,index:number):Promise<unknown>}
export interface SimreadyLoadResult {scene:object;userData?:Record<string,unknown>}
export class NeedleSimreadyLoaderPlugin {readonly name:'NEEDLE_simready';constructor(parser:SimreadyParser);afterRoot(result:SimreadyLoadResult):Promise<void>}
export interface SimreadyLoader {register(factory:(parser:SimreadyParser)=>NeedleSimreadyLoaderPlugin):unknown}
export function registerSimreadyLoader<T extends SimreadyLoader>(loader:T):T;
export function getSimreadyRuntime(asset:unknown):SimreadyRuntime|null;
