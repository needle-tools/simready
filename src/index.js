// @ts-check

/** @typedef {[number, number, number]} PhysicsVector */
/** @typedef {[number, number, number, number]} PhysicsRotation */
/** @typedef {{ path: string; type?: string; reason: string }} PhysicsIssue */
/** @typedef {{
    mass?: number | null; density?: number | null; centerOfMass?: PhysicsVector;
    diagonalInertia?: PhysicsVector; principalAxes?: PhysicsRotation;
}} PhysicsMass */
/** @typedef {PhysicsMass & {
    path: string; position: PhysicsVector; rotation: PhysicsRotation; scale?: PhysicsVector;
    rigidBodyEnabled?: boolean; kinematicBody?: boolean; startsAsleep?: boolean;
    linearVelocity?: PhysicsVector; angularVelocity?: PhysicsVector;
    filteredCollisions?: string[]; simulationOwners?: string[];
}} PhysicsBody */
/** @typedef {PhysicsMass & {
    path: string; type: string; body?: string; position?: PhysicsVector; rotation?: PhysicsRotation;
    scale?: PhysicsVector; collisionEnabled?: boolean; simulationOwners?: string[];
    materials?: string[]; filteredCollisions?: string[]; collisionGroups?: string[];
    halfExtents?: PhysicsVector; radius?: number; halfHeight?: number; axis?: 'X' | 'Y' | 'Z';
    approximation?: string; meshScale?: PhysicsVector; points?: number[] | Float32Array; indices?: number[] | Int32Array | Uint16Array | Uint32Array;
}} PhysicsShape */
/** @typedef {{ enabled: boolean; lower: number | null; upper: number | null }} PhysicsLimit */
/** @typedef {{
    enabled: boolean; targetPosition: number; targetVelocity: number; stiffness: number;
    damping: number; acceleration?: boolean; forceLimit?: number | null;
}} PhysicsDrive */
/** @typedef {{
    path: string; type: string; body0?: string; body1?: string;
    position0?: PhysicsVector; position1?: PhysicsVector; rotation0?: PhysicsRotation; rotation1?: PhysicsRotation;
    jointEnabled?: boolean; collisionEnabled?: boolean; excludeFromArticulation?:boolean; axis?: 'X' | 'Y' | 'Z';
    limit?: PhysicsLimit; drive?: PhysicsDrive; minEnabled?: boolean; maxEnabled?: boolean;
    breakForce?: number | null; breakTorque?: number | null; minDistance?: number; maxDistance?: number;
    mimic?: {joint:string;multiplier:number;offset:number};
}} PhysicsJoint */
/** @typedef {{
    path:string;rootPrims:string[];filteredCollisions:string[];
    articulatedJoints:string[];articulatedBodies:string[];
}} PhysicsArticulation */
/** @typedef {{
    articulations?:PhysicsArticulation[];
    metersPerUnit?: number; kilogramsPerUnit?: number; upAxis?: string;
    scenes: { path: string; gravityDirection?: PhysicsVector; gravityMagnitude?: number }[];
    bodies: PhysicsBody[]; shapes: PhysicsShape[]; joints: PhysicsJoint[];
    materials: { path: string; staticFriction?: number; dynamicFriction?: number; restitution?: number; density?: number }[];
    groups: { path: string; filteredGroups?: string[]; invertFilteredGroups?: boolean; mergedGroups?: string[] }[];
    unsupported?: PhysicsIssue[];
}} PhysicsSnapshot */
/** @typedef {{node:number;path:string;body?:string;instance?:unknown}} SimreadyBinding */
/** @typedef {{version:1;
time:number;
stage:Record<string,unknown>;
prims:Array<{path:string;type:string;active?:false;metadata?:Record<string,unknown>;attributes?:Array<{name:string;type:string;value:unknown;metadata?:Record<string,unknown>;connections?:string[];default?:unknown;samples?:Array<{time:number;value:unknown}>}>;relationships?:Array<{name:string;metadata?:Record<string,unknown>;targets:string[]}>;variants?:Array<{name:string;selection:string;choices:string[]}>}>;}} SimreadyMetadata */
/** @typedef {Omit<PhysicsShape,'points'|'indices'>&{mesh?:number,points?:never,indices?:never}} WireShape */
/** @typedef {Omit<PhysicsSnapshot,'metersPerUnit'|'kilogramsPerUnit'|'upAxis'>} GltfPhysicsSnapshot */
/** @typedef {Omit<GltfPhysicsSnapshot,'shapes'>&{shapes:WireShape[]}} WireSnapshot */
/** @typedef {{version:1;
stageNode:number;
snapshot:WireSnapshot;
usdMetadata:SimreadyMetadata;
bindings:SimreadyBinding[];
mappingIssues:PhysicsIssue[]}} SimreadyExtension */

import {isSnapshot, isMetadata, isArray, isBinding, isIssue, isWireSnapshot} from './validation.js';

import {copyJson} from './json.js';

/** Encode semantic metadata without silently replacing infinities with null.
 * @param {unknown} value @returns {unknown}
 */
export const encodeMetadata = value => copyJson(value, true);

export const SIMREADY_EXTENSION = 'NEEDLE_simready';

/** Runtime descriptors retain stage units and explicit body/joint identities. */
/** @param {unknown} snapshot @returns {PhysicsSnapshot} */
export function validateSnapshot(snapshot) {
    if (!isSnapshot(snapshot)) throw new TypeError('Invalid physics snapshot.');
    if (!snapshot || typeof snapshot !== 'object') throw new TypeError('A physics snapshot is required.');
    for (const key of /** @type {const} */ (['bodies', 'shapes', 'joints', 'materials', 'groups', 'scenes', 'articulations'])) {
        if (key === 'articulations' && snapshot.articulations === undefined) continue;
        if (!Array.isArray(snapshot[key])) throw new TypeError('Invalid physics snapshot: ' + key);
        const paths = new Set();
        for (const item of snapshot[key] ?? []) {
            if (typeof item.path !== 'string' || !item.path || paths.has(item.path)) throw new TypeError('Invalid or duplicate ' + key + ' identity: ' + item.path);
            paths.add(item.path);
        }
    }
    for (const body of snapshot.bodies) {
        for (const [key, length] of /** @type {const} */ ([['position', 3], ['rotation', 4]])) {
            if (body[key]?.length !== length || !Array.from(body[key]).every(Number.isFinite)) throw new TypeError('Invalid body ' + key + ': ' + body.path);
        }
        if (!Array.from(body.rotation).some(value => value !== 0)) throw new TypeError('Invalid body rotation: ' + body.path);
    }
    for (const articulation of snapshot.articulations || []) for (const key of /** @type {const} */ (['rootPrims','filteredCollisions','articulatedJoints','articulatedBodies'])) {
        if (!Array.isArray(articulation[key]) || articulation[key].some(path => typeof path !== 'string'))
            throw new TypeError('Invalid articulation '+key+': '+articulation.path);
    }
    return snapshot;
}

/** Invalid references are distinct from a solver's feature limitations. */
/** @param {PhysicsSnapshot} snapshot */
export function getSnapshotIssues(snapshot){
    /** @type {PhysicsIssue[]} */
    const issues=[];
    /** @param {'bodies'|'shapes'|'joints'|'materials'|'groups'|'scenes'} key */
    const ids=key=>new Set((snapshot[key]||[]).map(item=>item.path));
    const bodies=ids('bodies'),materials=ids('materials'),groups=ids('groups'),scenes=ids('scenes'),joints=ids('joints');
    for(const group of snapshot.groups||[])for(const alias of group.mergedGroups||[])groups.add(alias);
    /** @param {{path:string,type?:string}} item @param {string|undefined} target @param {Set<string>} known @param {string} label */
    const missing=(item,target,known,label)=>{if(target&&!known.has(target))issues.push({path:item.path,type:item.type,reason:label+' references unavailable '+target});};
    for(const shape of snapshot.shapes||[]){missing(shape,shape.body,bodies,'Collider owner');for(const material of shape.materials||[])missing(shape,material,materials,'Physics material');for(const group of shape.collisionGroups||[])missing(shape,group,groups,'Collision group');}
    for(const joint of snapshot.joints||[]){for(const end of [0,1])missing(joint,joint[end === 0 ? 'body0' : 'body1'],bodies,'Joint body');if(joint.mimic)missing(joint,joint.mimic.joint,joints,'Mimic joint');}
    for(const articulation of snapshot.articulations||[]){
        const item={...articulation,type:'Articulation'},members=new Set(articulation.articulatedBodies);
        for(const path of articulation.articulatedBodies)missing(item,path,bodies,'Articulation body');
        for(const path of articulation.articulatedJoints){
            missing(item,path,joints,'Articulation joint');
            const joint=snapshot.joints.find(joint=>joint.path===path);
            if(joint)for(const end of [0,1])missing(item,joint[end === 0 ? 'body0' : 'body1'],members,'Articulation joint body');
        }
    }
    for(const item of [...(snapshot.bodies||[]),...(snapshot.shapes||[])])for(const scene of item.simulationOwners||[])missing(item,scene,scenes,'Simulation owner');
    return issues;
}

/** Build the versioned glTF contract; geometry stays in ordinary glTF meshes. */
/** @param {{snapshot: WireSnapshot, bindings: SimreadyBinding[], stageNode: number, usdMetadata?: SimreadyMetadata, mappingIssues?: PhysicsIssue[]}} options */
export function createSimreadyExtension({snapshot, bindings, stageNode, usdMetadata = {version: 1, time: 0, stage: {}, prims: []}, mappingIssues = []}) {
    validateSnapshot(snapshot);
    if (!isWireSnapshot(snapshot)) throw new TypeError('Invalid SimReady payload.');
    if (!Number.isInteger(stageNode) || stageNode < 0 || !Array.isArray(bindings)) throw new TypeError('SimReady requires a stage node and bindings.');
    if (usdMetadata.version !== 1 || !Array.isArray(usdMetadata.prims)) throw new TypeError('Invalid SimReady semantic metadata.');
    const nodes = new Set(), bodies = new Set(snapshot.bodies.map(body => body.path));
    for (const binding of bindings) {
        if (!Number.isInteger(binding.node) || binding.node < 0 || nodes.has(binding.node) || typeof binding.path !== 'string' || binding.body && !bodies.has(binding.body)) throw new TypeError('Invalid or duplicate SimReady binding identity.');
        nodes.add(binding.node);
    }
    for (const shape of snapshot.shapes) if (shape.type === 'mesh' && (typeof shape.mesh !== 'number' || !Number.isInteger(shape.mesh) || shape.mesh < 0 || shape.points !== undefined || shape.indices !== undefined)) throw new TypeError('SimReady collision geometry requires a glTF mesh reference.');
    // JSON's null representation matches the existing snapshot contract for
    // unbounded numeric fields. Semantic metadata uses explicit tagged values.
    const encodedMetadata = encodeMetadata(usdMetadata);
    if (!isMetadata(encodedMetadata)) throw new TypeError('Invalid SimReady semantic metadata.');
    const clonedSnapshot = copyJson(snapshot), clonedBindings = copyJson(bindings), clonedIssues = copyJson(mappingIssues);
    if (!isWireSnapshot(clonedSnapshot) || !isArray(clonedBindings) || !clonedBindings.every(isBinding) || !isArray(clonedIssues) || !clonedIssues.every(isIssue)) throw new TypeError('Invalid SimReady payload.');
    return {version: /** @type {const} */ (1), stageNode, snapshot: clonedSnapshot, usdMetadata: encodedMetadata, bindings: clonedBindings, mappingIssues: clonedIssues};
}
