// @ts-check
/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('./types.js').EnginePhysics} EnginePhysics */
/** @typedef {import('./types.js').EngineAsset} EngineAsset */
/** @typedef {import('./types.js').EngineBody} EngineBody */
/** @typedef {import('./types.js').NeedleBody} NeedleBody */
/** @typedef {import('../description.js').BodyDescription} BodyDescription */
/** @typedef {import('../needle.js').NeedleSimulationAsset} NeedleSimulationAsset */
/** @typedef {import('../needle.js').NeedleSimulationWorld} NeedleSimulationWorld */
/** @typedef {import('../needle.js').NeedleAssetOptions} NeedleAssetOptions */
/** @typedef {import('../needle.js').NeedleBodyRecord} NeedleBodyRecord */
/** @typedef {import('../needle.js').NeedleColliderRecord} NeedleColliderRecord */
import {supportsPhysicsAssets} from './types.js';
import {describeSimulation} from '../description.js';
import {validateSnapshot} from '../index.js';
import {getSimulationLimitations} from '../rapier.js';
import {createSimulationRuntime} from '../simulationRuntime.js';
import {transformSnapshot} from '../transform.js';

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

/** Wraps an Engine body handle with the method names the runtime and visual binding use.
 * Visuals are bound before Engine creates the body, so until then it returns the starting pose.
 * @param {BodyDescription} description @returns {NeedleBody} */
function bodyAdapter(description) {
    /** @type {EngineBody|undefined} */
    let handle;
    const copy = /** @template T @param {T} value @returns {T} */ value => ({...value});
    return {
        get handle() { return handle; },
        attach(value) { handle = value; },
        isValid: () => !!handle?.isValid,
        translation: () => handle ? handle.getPosition() : copy(description.position),
        rotation: () => handle ? handle.getRotation() : copy(description.rotation),
        linvel: () => handle ? handle.getLinearVelocity() : copy(description.linearVelocity),
        angvel: () => handle ? handle.getAngularVelocity() : copy(description.angularVelocity),
        mass: () => handle?.mass ?? 0,
        isDynamic: () => (handle?.type ?? description.type) === 'dynamic',
        isSleeping: () => !!handle?.isSleeping,
        setTranslation(value, wake) { handle?.setPose({position: value}, wake); },
        setRotation(value, wake) { handle?.setPose({rotation: value}, wake); },
        setLinvel(value, wake) { handle?.setLinearVelocity(value, wake); },
        setAngvel(value, wake) { handle?.setAngularVelocity(value, wake); },
        resetForces(wake) { handle?.resetForces(wake); },
        // resetForces already clears torques too.
        resetTorques() {},
        sleep() { handle?.sleep(); },
        wakeUp() { handle?.wakeUp(); },
    };
}

/** Create a world that turns SimReady snapshots into Engine physics assets. */
/** @param {{context:{scene:Object3D,physics:{getOrCreatePhysicsEngine():unknown}},metersPerUnit?:number,kilogramsPerUnit?:number}} options
 * @returns {Promise<NeedleSimulationWorld>} */
export async function createNeedleWorld({context, metersPerUnit = 1, kilogramsPerUnit = 1}) {
    if (!Number.isFinite(metersPerUnit) || !Number.isFinite(kilogramsPerUnit) || !(metersPerUnit > 0) || !(kilogramsPerUnit > 0)) throw new TypeError('Invalid Needle world units.');
    const physics = context?.physics?.getOrCreatePhysicsEngine();
    if (!physics) throw new Error('Needle physics is disabled or unavailable.');
    if (!supportsPhysicsAssets(physics))
        throw new Error('This Needle Engine version does not support physics assets. Update @needle-tools/engine.');
    if (await physics.initialize() === false || !physics.capabilities) throw new Error('Needle physics is disabled or unavailable.');
    const capabilities = physics.capabilities;
    /** @type {Map<string,NeedleSimulationAsset>} */
    const assets = new Map();
    /** @type {Set<string>} */
    const pending = new Set();
    /** @type {Set<AbortController>} */
    const pendingBindings = new Set();
    let disposed = false, nextId = 1;
    const active = () => {if (disposed) throw new Error('Simulation world is disposed.');};
    /** @type {(()=>void)|undefined} */
    let detachWorld;
    /** @type {NeedleSimulationWorld} */
    const host = {
        physics, capabilities, metersPerUnit, kilogramsPerUnit, assets,
        async addAsset({snapshot, id = 'asset-' + nextId++, position, rotation, bindVisuals, scenePath, allowPartial = false, mode}) {
            active();
            if (mode && mode !== 'simulation') throw new Error('Shared worlds run dynamics; use createMechanism for posing.');
            if (assets.has(id) || pending.has(id)) throw new Error('Duplicate simulation asset: ' + id);
            pending.add(id);
            const abort = new AbortController();
            pendingBindings.add(abort);
            /** @type {import('../rapier.js').VisualBinding|undefined} */
            let binding;
            /** @type {EngineAsset|undefined} */
            let engineAsset;
            try {
                validateSnapshot(snapshot);
                const limitations = getSimulationLimitations(snapshot);
                if (!allowPartial && limitations.length) throw new Error(`Simulation unavailable: ${limitations[0].reason}`);
                const resolved = transformSnapshot(snapshot, {metersPerUnit, kilogramsPerUnit, position, rotation});
                const description = describeSimulation(resolved, {scenePath, mode: 'simulation', capabilities});
                const unsupported = [...limitations];
                /** @param {{path:string,type?:string}} item @param {string} reason */
                const warn = (item, reason) => {if (!unsupported.some(issue => issue.path === item.path && issue.reason === reason)) unsupported.push({path: item.path, type: item.type, reason});};
                for (const issue of description.issues) warn(issue, issue.reason);
                const fail = () => {if (!allowPartial && unsupported.length) throw new Error(`Simulation unavailable: ${unsupported[0].reason}${unsupported.length > 1 ? ` (${unsupported.length} unsupported features)` : ''}`);};
                fail();
                /** @type {Map<string,NeedleBodyRecord>} */
                const bodies = new Map(description.bodies.map(item => [item.id, {data: /** @type {import('../index.js').PhysicsBody} */ (description.bodyData.get(item.id)), body: bodyAdapter(item), colliders: []}]));
                /** @type {Map<string,NeedleColliderRecord>} */
                const colliders = new Map(description.colliders.map(item => [item.id, {data: /** @type {import('../description.js').ColliderData} */ (description.colliderData.get(item.id)).data,
                    collider: null, owner: item.body !== undefined ? bodies.get(item.body) : undefined}]));
                binding = await bindVisuals?.(bodies, warn, abort.signal, colliders) || emptyBinding;
                abort.signal.throwIfAborted();
                fail();
                const visuals = binding, bindings = visuals.bindings || [];
                const root = visuals.root || context.scene;
                // Each instanced body needs its own Engine identity. Omit an
                // ambiguous render object so the Engine can create that identity.
                const objects = new Map(description.bodies.map(item => [item.id, visualObject(item.id, bindings, visuals.root)]));
                let engineReleased = false, finished = false;
                /** @type {NeedleSimulationAsset|undefined} */
                let simulation;
                const finish = () => {
                    if (finished) return;
                    finished = true;
                    try { visuals.dispose?.(); }
                    finally { if (simulation && assets.get(id) === simulation) assets.delete(id); }
                };
                const created = engineAsset = physics.createAsset({
                    root, syncTransforms: false, allowPartial: true,
                    bodies: description.bodies.map(item => ({...item, object: objects.get(item.id)})),
                    colliders: description.colliders.map(item => ({...item, object: objects.get(item.body ?? '')})),
                    joints: description.joints, articulations: description.articulations,
                    shouldCollide: (a, b) => description.shouldCollide(a.id, b.id),
                    onAfterStep: () => visuals.sync(),
                    // Engine has already removed the physics objects. Restore the visuals and drop the asset.
                    onDestroy: () => { engineReleased = true; try { visuals.reset(); } finally { finish(); } },
                });
                for (const issue of created.issues) warn({path: issue.id}, issue.reason);
                fail();
                for (const [path, record] of bodies) {
                    const handle = created.bodies.get(path);
                    if (!handle) throw new Error('Engine did not create imported body: ' + path);
                    record.body.attach(handle);
                }
                /** @type {Map<string,import('@needle-tools/engine').Collider>} */
                const colliderComponents = new Map();
                for (const [path, record] of colliders) {
                    const handle = created.colliders.get(path);
                    if (!handle) { colliders.delete(path); continue; }
                    record.collider = handle;
                    record.owner?.colliders.push(handle);
                    colliderComponents.set(path, /** @type {import('@needle-tools/engine').Collider} */ (handle.component));
                }
                const rigidbodies = new Map([...bodies].map(([path, record]) => [path, /** @type {import('@needle-tools/engine').Rigidbody} */ (/** @type {EngineBody} */ (record.body.handle).component)]));
                const articulation = created.adaptations.filter(item => item.source === 'reduced-coordinate articulation');
                const adaptations = [...articulation, ...description.adaptations.map(item => ({...item, id: item.path})), ...created.adaptations.filter(item => !articulation.includes(item))]
                    .map(({id: path, source, target, reason}) => ({path, source, target, reason}));
                const runtime = createSimulationRuntime({snapshot: resolved, mode: 'simulation', bodies,
                    joints: new Map([...description.jointData].filter(([path]) => created.joints.has(path))),
                    binding: visuals, isReleased: () => engineReleased,
                    release: () => { try { created.dispose(); } finally { finish(); } },
                    backend: {
                        hold: () => created.hold(), release: () => created.release(),
                        setDriveTarget: (path, value, velocity) => created.joints.get(path)?.setDriveTarget({position: value, velocity}) ?? false,
                        beginDrag(body, point, local, stiffness, damping) {
                            const component = body.handle?.component;
                            if (!component) throw new Error('The dragged body is unavailable.');
                            const drag = physics.createAsset({root,
                                bodies: [{id: 'anchor', type: 'kinematic', position: point}],
                                joints: [{id: 'drag', type: 'spring', body0: component, body1: 'anchor', anchor0: local, spring: {stiffness, damping}}]});
                            const anchor = drag.bodies.get('anchor');
                            return {move(next) { anchor?.setKinematicTarget({position: next}); }, end() { drag.dispose(); }};
                        },
                    }});
                const result = simulation = Object.assign(runtime, {
                    id, snapshot: resolved, bodies, colliders, joints: created.joints, unsupported, rigidbodies, colliderComponents, physicsAsset: created,
                    backend: {name: capabilities.backend, jointSolver: adaptations.some(item => item.target === 'reduced-coordinate fixed links with impulse motion joints') ? /** @type {const} */ ('hybrid') : /** @type {const} */ ('impulse'), adaptations},
                });
                if (disposed) throw new Error('Simulation world is disposed.');
                assets.set(id, result);
                return result;
            } catch (error) {
                try { if (engineAsset && !engineAsset.isDisposed) engineAsset.dispose(); }
                finally { try { binding?.reset(); } finally { binding?.dispose?.(); } }
                throw error;
            } finally { pending.delete(id); pendingBindings.delete(abort); }
        },
        removeAsset(id) {active(); const asset = assets.get(id); asset?.dispose(); return !!asset;},
        dispose() {
            if (disposed) return;
            disposed = true;
            const errors = [];
            try { detachWorld?.(); } catch (error) { errors.push(error); }
            for (const abort of pendingBindings) abort.abort();
            for (const asset of [...assets.values()]) try { asset.dispose(); } catch (error) { errors.push(error); }
            if (errors.length) throw new AggregateError(errors, 'Simulation world disposal failed.');
        },
    };
    // Engine frees its world when the context is cleared. Remove our assets first and cancel any loads still binding visuals.
    detachWorld = physics.onWorldDisposed(() => host.dispose());
    return host;
}
