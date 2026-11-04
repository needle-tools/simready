import {createSimulationWorld} from '../rapier.js';

const emptyBinding = {sync(){}, reset(){}, bodyForObject(){return null;}};
const under = (object,parent) => {for(let current=object;current;current=current.parent)if(current===parent)return true;return false;};
function visualObject(path,bindings,root) {
    const objects = [...new Set(bindings.filter(binding => binding.body === path).map(binding => binding.object))];
    if (!objects.length || objects.some(object => object.isInstancedMesh)) return undefined;
    if (objects.length === 1) return objects[0];
    // A split render mesh can share its body's ancestor, provided that ancestor
    // does not also represent another body or escape the asset's visual root.
    for (let candidate = objects[0];candidate && under(candidate,root);candidate = candidate.parent) {
        if (objects.every(object => under(object,candidate)))
            return bindings.some(binding => binding.body !== path && under(binding.object,candidate)) ? undefined : candidate;
    }
    return undefined;
}

/** Internal dependency boundary keeps standalone imports independent of Engine. */
export async function createNeedleWorld(engine, {context, metersPerUnit = 1, kilogramsPerUnit = 1}) {
    const physics = context?.physics?.getOrCreatePhysicsEngine();
    if (!physics) throw new Error('Needle physics is disabled or unavailable.');
    if (!physics.registerExternalPhysics)
        throw new Error('This Needle Engine version does not support external physics registration.');
    await physics.initialize();
    const host = createSimulationWorld({rapier: engine.NEEDLE_ENGINE_MODULES.RAPIER_PHYSICS.MODULE,
        world: physics.world, metersPerUnit, kilogramsPerUnit,
        registerWorldExtension: extension => physics.registerWorldExtension(extension)});
    const addAsset = host.addAsset.bind(host);
    host.addAsset = async ({bindVisuals, ...options}) => {
        let runtime, registration, destroyed = false;
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
                    colliders:[...colliders.values()].map(record => ({collider:record.collider, object:objects.get(record.owner?.data.path)})),
                    onDestroy(){destroyed = true;runtime?.dispose();},
                });
                for (const [path,record] of bodies) rigidbodies.set(path,registration.rigidbodies.get(record.body.handle));
                signal.addEventListener('abort', cleanup, {once:true});
                return {...visuals, dispose:cleanup};
            } catch(error) {cleanup();throw error;}
        }});
        if (destroyed) {runtime.dispose();throw new Error('Imported physics was destroyed during attachment.');}
        return Object.assign(runtime, {rigidbodies, colliderComponents:registration.colliders});
    };
    return host;
}
