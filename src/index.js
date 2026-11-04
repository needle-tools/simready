/** Encode semantic metadata without silently replacing infinities with null. */
export const encodeMetadata = value => JSON.parse(JSON.stringify(value, (_key, item) => {
    if (typeof item === 'number' && !Number.isFinite(item)) return {$usdNumber: String(item)};
    if (typeof item === 'bigint') return {$usdInteger: String(item)};
    if (ArrayBuffer.isView(item)) return Array.from(item);
    return item;
}));

export const SIMREADY_EXTENSION = 'NEEDLE_simready';

/** Runtime descriptors retain stage units and explicit body/joint identities. */
export function validateSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') throw new TypeError('A physics snapshot is required.');
    for (const key of ['bodies', 'shapes', 'joints', 'materials', 'groups', 'scenes', ...(snapshot.articulations === undefined ? [] : ['articulations'])]) {
        if (!Array.isArray(snapshot[key])) throw new TypeError('Invalid physics snapshot: ' + key);
        const paths = new Set();
        for (const item of snapshot[key]) {
            if (typeof item.path !== 'string' || !item.path || paths.has(item.path)) throw new TypeError('Invalid or duplicate ' + key + ' identity: ' + item.path);
            paths.add(item.path);
        }
    }
    for (const body of snapshot.bodies) {
        for (const [key, length] of [['position', 3], ['rotation', 4]]) {
            if (body[key]?.length !== length || !Array.from(body[key]).every(Number.isFinite)) throw new TypeError('Invalid body ' + key + ': ' + body.path);
        }
        if (!Array.from(body.rotation).some(value => value !== 0)) throw new TypeError('Invalid body rotation: ' + body.path);
    }
    for (const articulation of snapshot.articulations || []) for (const key of ['rootPrims','filteredCollisions','articulatedJoints','articulatedBodies']) {
        if (!Array.isArray(articulation[key]) || articulation[key].some(path => typeof path !== 'string'))
            throw new TypeError('Invalid articulation '+key+': '+articulation.path);
    }
    return snapshot;
}

/** Invalid references are distinct from a solver's feature limitations. */
export function getSnapshotIssues(snapshot){
    const issues=[],ids=key=>new Set((snapshot[key]||[]).map(item=>item.path));
    const bodies=ids('bodies'),materials=ids('materials'),groups=ids('groups'),scenes=ids('scenes'),joints=ids('joints');
    for(const group of snapshot.groups||[])for(const alias of group.mergedGroups||[])groups.add(alias);
    const missing=(item,target,known,label)=>{if(target&&!known.has(target))issues.push({path:item.path,type:item.type,reason:label+' references unavailable '+target});};
    for(const shape of snapshot.shapes||[]){missing(shape,shape.body,bodies,'Collider owner');for(const material of shape.materials||[])missing(shape,material,materials,'Physics material');for(const group of shape.collisionGroups||[])missing(shape,group,groups,'Collision group');}
    for(const joint of snapshot.joints||[]){for(const end of [0,1])missing(joint,joint['body'+end],bodies,'Joint body');if(joint.mimic)missing(joint,joint.mimic.joint,joints,'Mimic joint');}
    for(const articulation of snapshot.articulations||[]){
        const item={...articulation,type:'Articulation'},members=new Set(articulation.articulatedBodies);
        for(const path of articulation.articulatedBodies)missing(item,path,bodies,'Articulation body');
        for(const path of articulation.articulatedJoints){
            missing(item,path,joints,'Articulation joint');
            const joint=snapshot.joints.find(joint=>joint.path===path);
            if(joint)for(const end of [0,1])missing(item,joint['body'+end],members,'Articulation joint body');
        }
    }
    for(const item of [...(snapshot.bodies||[]),...(snapshot.shapes||[])])for(const scene of item.simulationOwners||[])missing(item,scene,scenes,'Simulation owner');
    return issues;
}

/** Build the versioned glTF contract; geometry stays in ordinary glTF meshes. */
export function createSimreadyExtension({snapshot, bindings, stageNode, usdMetadata = {version: 1, time: 0, stage: {}, prims: []}, mappingIssues = []}) {
    validateSnapshot(snapshot);
    if (!Number.isInteger(stageNode) || stageNode < 0 || !Array.isArray(bindings)) throw new TypeError('SimReady requires a stage node and bindings.');
    if (usdMetadata.version !== 1 || !Array.isArray(usdMetadata.prims)) throw new TypeError('Invalid SimReady semantic metadata.');
    const nodes = new Set(), bodies = new Set(snapshot.bodies.map(body => body.path));
    for (const binding of bindings) {
        if (!Number.isInteger(binding.node) || binding.node < 0 || nodes.has(binding.node) || typeof binding.path !== 'string' || binding.body && !bodies.has(binding.body)) throw new TypeError('Invalid or duplicate SimReady binding identity.');
        nodes.add(binding.node);
    }
    for (const shape of snapshot.shapes) if (shape.type === 'mesh' && (!Number.isInteger(shape.mesh) || shape.mesh < 0 || shape.points !== undefined || shape.indices !== undefined)) throw new TypeError('SimReady collision geometry requires a glTF mesh reference.');
    // JSON's null representation matches the existing snapshot contract for
    // unbounded numeric fields. Semantic metadata uses explicit tagged values.
    const clone = value => JSON.parse(JSON.stringify(value, (_key, item) => ArrayBuffer.isView(item) ? Array.from(item) : item));
    return {version: 1, stageNode, snapshot: clone(snapshot), usdMetadata: encodeMetadata(usdMetadata), bindings: clone(bindings), mappingIssues: clone(mappingIssues)};
}
