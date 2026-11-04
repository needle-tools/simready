// @ts-check
/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('./types.js').World} World */
/** @typedef {import('./types.js').RigidBody} RigidBody */
/** @typedef {import('./types.js').Rigidbody} Rigidbody */
/** @typedef {import('../needle.js').NeedleSimulationAsset} NeedleSimulationAsset */
import {supportsExternalPhysics} from './types.js';
import {createSimulationWorld} from '../rapier.js';

/** @type {import('../rapier.js').VisualBinding} */
const emptyBinding = {sync(){}, reset(){}, bodyForObject(){return null;}};
/** @param {Object3D} object @param {Object3D|undefined} parent */
const under = (object,parent) => {
    /** @type {Object3D|null} */
    let current=object;
    for(;current;current=current.parent)if(current===parent)return true;return false;
};
/** @param {string} path @param {import('../three.js').ObjectBinding[]} bindings @param {Object3D|undefined} root */
function visualObject(path,bindings,root) {
    const objects = [...new Set(bindings.filter(binding => binding.body === path).map(binding => binding.object))];
    if (!objects.length || objects.some(object => 'isInstancedMesh' in object&&object.isInstancedMesh===true)) return undefined;
    if (objects.length === 1) return objects[0];
    // A split render mesh can share its body's ancestor, provided that ancestor
    // does not also represent another body or escape the asset's visual root.
    /** @type {Object3D|null} */
    let candidate = objects[0];
    for (;candidate && under(candidate,root);candidate = candidate.parent) {
        const ancestor=candidate;
        if (objects.every(object => under(object,ancestor)))
            return bindings.some(binding => binding.body !== path && under(binding.object,ancestor)) ? undefined : ancestor;
    }
    return undefined;
}

/** Internal dependency boundary keeps standalone imports independent of Engine. */
/** @param {{NEEDLE_ENGINE_MODULES:{RAPIER_PHYSICS:{MODULE:import('../rapier.js').RapierModule<RigidBody,World>}}}} engine
 * @param {{context:{scene:Object3D,physics:{getOrCreatePhysicsEngine():unknown}},metersPerUnit?:number,kilogramsPerUnit?:number}} options
 * @returns {Promise<import('../needle.js').NeedleSimulationWorld>} */
export async function createNeedleWorld(engine, {context, metersPerUnit = 1, kilogramsPerUnit = 1}) {
    const physics = context?.physics?.getOrCreatePhysicsEngine();
    if (!physics) throw new Error('Needle physics is disabled or unavailable.');
    if (!supportsExternalPhysics(physics))
        throw new Error('This Needle Engine version does not support external physics registration.');
    await physics.initialize();
    const host = createSimulationWorld({rapier: engine.NEEDLE_ENGINE_MODULES.RAPIER_PHYSICS.MODULE,
        world: physics.world, metersPerUnit, kilogramsPerUnit,
        registerWorldExtension: extension => physics.registerWorldExtension(extension)});
    const addAsset = host.addAsset.bind(host);
    /** @type {Map<string,NeedleSimulationAsset>} */
    const assets=new Map();
    /** @param {import('../rapier.js').WorldAssetOptions<RigidBody>} options @returns {Promise<NeedleSimulationAsset>} */
    const addNeedleAsset = async ({bindVisuals, ...options}) => {
        /** @type {import('../rapier.js').SimulationAsset<World,RigidBody>|undefined} */
        let runtime;
        /** @type {import('./types.js').ExternalRegistration|undefined} */
        let registration;
        let destroyed = false;
        /** @type {Map<string,Rigidbody>} */
        const rigidbodies = new Map();
        runtime = await addAsset({...options, bindVisuals: async (bodies, warn, signal, colliders) => {
            const visuals = await bindVisuals?.(bodies, warn, signal, colliders) || emptyBinding;
            let disposed = false;
            const cleanup = () => {
                if (disposed) return;
                disposed = true;
                signal.removeEventListener('abort', cleanup);
                try {registration?.dispose();} finally {rigidbodies.clear();visuals.dispose?.();}
            };
            try {
                signal.throwIfAborted();
                const bindings = visuals.bindings || [];
                // Each instanced body needs its own Engine identity. Omit an
                // ambiguous render object so the Engine can create that identity.
                const objects = new Map([...bodies.keys()].map(path => [path,visualObject(path,bindings,visuals.root)]));
                registration = physics.registerExternalPhysics({
                    root: visuals.root || context.scene,
                    syncTransforms:false,
                    bodies:[...bodies].map(([path,record]) => ({body:record.body, object:objects.get(path)})),
                    colliders:[...colliders.values()].map(record => ({collider:record.collider, object:objects.get(record.owner?.data.path??'')})),
                    onDestroy(){destroyed = true;runtime?.dispose();},
                });
                for (const [path,record] of bodies){
                    const component=registration.rigidbodies.get(record.body.handle);
                    if(!component)throw new Error('Engine did not register imported body: '+path);
                    rigidbodies.set(path,component);
                }
                signal.addEventListener('abort', cleanup, {once:true});
                return {...visuals, dispose:cleanup};
            } catch(error) {cleanup();throw error;}
        }});
        if (destroyed) {runtime.dispose();throw new Error('Imported physics was destroyed during attachment.');}
        if(!registration){runtime.dispose();throw new Error('Engine did not register imported physics.');}
        const asset=Object.assign(runtime, {rigidbodies, colliderComponents:registration.colliders});
        const dispose=asset.dispose;
        asset.dispose=()=>{try{dispose();}finally{if(assets.get(asset.id)===asset)assets.delete(asset.id);}};
        assets.set(asset.id,asset);
        return asset;
    };
    return {...host,assets,addAsset:addNeedleAsset};
}
