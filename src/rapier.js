// @ts-check

/** @typedef {import('./index.js').PhysicsSnapshot} PhysicsSnapshot */
/** @typedef {import('./index.js').PhysicsBody} PhysicsBody */
/** @typedef {import('./index.js').PhysicsShape} PhysicsShape */
/** @typedef {import('./index.js').PhysicsJoint} PhysicsJoint */
/** @typedef {import('./index.js').PhysicsDrive} PhysicsDrive */
/** @typedef {import('./index.js').PhysicsIssue} PhysicsIssue */
/** @typedef {import('./index.js').PhysicsVector} PhysicsVector */
/** @typedef {import('./index.js').PhysicsRotation} PhysicsRotation */
/** @typedef {import('./rapier-types.js').RigidBody} RigidBody */
/** @typedef {import('./rapier-types.js').Collider} Collider */
/** @typedef {import('./rapier-types.js').Joint} Joint */
/** @typedef {import('./rapier-types.js').RigidBodyDescriptor} RigidBodyDescriptor */
/** @typedef {import('./rapier-types.js').JointDescriptor} JointDescriptor */
/** @template {RigidBody} [B=RigidBody]
 * @typedef {import('./rapier-types.js').World<B>} World */
/** @template {RigidBody} [B=RigidBody]
 * @template {World<B>} [W=World<B>]
 * @typedef {import('./rapier-types.js').RapierModule<B,W>} RapierModule */
/** @template {RapierModule} R
 * @typedef {InstanceType<R['World']>} WorldOf */
/** @template {RapierModule} R
 * @typedef {ReturnType<WorldOf<R>['createRigidBody']>} BodyOf */
/** @typedef {{sync():void, reset():void, dispose?():void,
 * bodyForObject(object:unknown,instanceIndex?:number):unknown,
 * root?:import('three').Object3D,bindings?:import('./three.js').ObjectBinding[]}} VisualBinding */
/** @template [B=RigidBody]
 * @typedef {{data:PhysicsBody,body:B,colliders:Collider[]}} SimulationBodyRecord */
/** @template [B=RigidBody]
 * @typedef {Map<string,SimulationBodyRecord<B>>} SimulationBodies */
/** @template [B=RigidBody]
 * @typedef {{data:PhysicsShape,collider:Collider,owner?:SimulationBodyRecord<B>}} SimulationColliderRecord */
/** @template [B=RigidBody]
 * @typedef {Map<number,SimulationColliderRecord<B>>} SimulationColliders */
/** @template [W=World]
 * @template [B=RigidBody]
 * @typedef {{
 * readonly backend:{name:'rapier',jointSolver:'impulse'|'hybrid',adaptations:Array<{path:string,source:string,target:string,reason:string}>},
 * readonly world:W,readonly bodies:SimulationBodies<B>,readonly colliders:SimulationColliders<B>,
 * readonly joints:Map<string,Joint>,readonly unsupported:PhysicsIssue[],
 * play():void,pause():void,isPlaying():boolean,update(dt:number):void,step(dt?:number):void,
 * getJointValue(path:string):number|null,setJointTarget(path:string,target:{position?:number,velocity?:number}):boolean,
 * reset():void,dispose():void,bodyForObject(object:unknown,instanceIndex?:number):unknown,
 * beginDrag(path:string,position:import('./rapier-types.js').Vector):boolean,
 * moveDrag(position:import('./rapier-types.js').Vector):void,endDrag():void
 * }} Simulation */
/** @template {RigidBody} [B=RigidBody]
 * @template {World<B>} [W=World<B>]
 * @typedef {{snapshot:PhysicsSnapshot,rapier:RapierModule<B,W>,scenePath?:string,allowPartial?:boolean,mode?:'simulation'|'interaction',
 * bindVisuals?:(bodies:SimulationBodies<B>,warn:(item:{path:string,type?:string},reason:string)=>void,signal:AbortSignal,colliders:SimulationColliders<B>)=>VisualBinding|Promise<VisualBinding>}} SimulationOptions */
/** @template {RigidBody} [B=RigidBody]
 * @typedef {Omit<SimulationOptions<B>,'rapier'> & {id?:string,position?:PhysicsVector,rotation?:PhysicsRotation}} WorldAssetOptions */
/** @template [W=World]
 * @template [B=RigidBody]
 * @typedef {Simulation<W,B> & {readonly id:string,readonly snapshot:PhysicsSnapshot}} SimulationAsset */
/** @typedef {import('./rapier-types.js').PhysicsHooks} SimulationHooks */
/** Options for adding an asset to a shared world.
 * @typedef {{snapshot:PhysicsSnapshot,id?:string,position?:PhysicsVector,rotation?:PhysicsRotation,scenePath?:string,allowPartial?:boolean,mode?:'simulation',
 * bindVisuals?:(bodies:ReadonlyMap<string,{data:PhysicsBody,body:import('./kinematics.js').BodyPose}>,warn:(item:{path:string,type?:string},reason:string)=>void,
 * signal:AbortSignal)=>VisualBinding|Promise<VisualBinding>}} HostAssetOptions */
/** A world that several assets share: a SimReady world or a Needle Engine world.
 * @template A
 * @typedef {{readonly metersPerUnit:number,addAsset(options:HostAssetOptions):Promise<A>}} SimulationHost */
/** @typedef {{hooks:SimulationHooks,afterStep():void,dispose():void}} SimulationWorldExtension */
/** @template [W=World]
 * @template {RigidBody} [B=RigidBody]
 * @typedef {{readonly ownsWorld:boolean,readonly hooks:SimulationHooks,sync():void,
 * readonly metersPerUnit:number,readonly kilogramsPerUnit:number,readonly world:W,
 * readonly assets:ReadonlyMap<string,SimulationAsset<W,B>>,
 * addAsset(options:WorldAssetOptions<B>):Promise<SimulationAsset<W,B>>,
 * removeAsset(id:string):boolean,step(dt?:number):void,dispose():void}} SimulationWorld */
/** @template W
 * @typedef {{world:W,events:import('./rapier-types.js').EventQueue|undefined,isDisposed():boolean,
 * trackResources(cleanup:()=>void):()=>void,register(entry:{hooks:SimulationHooks,sync():void}):()=>void}} WorldContext */

import {Vector3} from 'three';
import {validateSnapshot,getSnapshotIssues} from './index.js';
import {transformSnapshot} from './transform.js';
import {describeSimulation,rapierCapabilities} from './description.js';
import {buildRapierAsset} from './rapierAsset.js';
import {createSimulationRuntime} from './simulationRuntime.js';
/** @param {PhysicsVector} a */
const vector = a => ({ x: a[0], y: a[1], z: a[2] });
const emptyVisualBinding = {sync(){},reset(){},bodyForObject(){return null;}};

/** Descriptors the Rapier adapter cannot simulate, known before loading its runtime. */
/** @param {PhysicsSnapshot} snapshot */
export function getSimulationLimitations(snapshot) {
    const issues=[...(snapshot.unsupported||[]),...getSnapshotIssues(snapshot)];
    for(const shape of snapshot.shapes||[])if(shape.collisionEnabled!==false && shape.type==='mesh' && shape.approximation && !['none','convexHull','sdf'].includes(shape.approximation))
        issues.push({path:shape.path,type:'mesh',reason:`Mesh approximation ${shape.approximation} is not supported.`});
    for(const joint of snapshot.joints||[])if(joint.mimic)issues.push({path:joint.path,type:joint.type,reason:"Mimic joint coupling is not supported by this contact adapter."});
    return issues;
}

/**
 * Create a simulation in stage coordinates. Supply an initialized Rapier module;
 * importing the USD renderer alone does not download another WASM runtime.
 */
/** @template {RigidBody} B
 * @template {World<B>} W
 * @param {SimulationOptions<B,W> & {worldContext?:WorldContext<W>}} options
 * @returns {Promise<Simulation<W,B>>}
 */
export async function createSimulation({ rapier: R, snapshot, scenePath, mode = 'simulation', allowPartial = false, bindVisuals, worldContext }) {
    snapshot=Object.assign({bodies:[],shapes:[],joints:[],materials:[],groups:[],scenes:[]},snapshot);
    validateSnapshot(snapshot);
    if (!R?.World) throw new TypeError('Supply an initialized Rapier module.');
    const initialIssues=getSimulationLimitations(snapshot).filter(item=>mode!=='interaction'||!/Shape$|^mesh$|^Articulation$/.test(item.type||''));
    if(!allowPartial&&initialIssues.length)throw new Error(`Simulation unavailable: ${initialIssues[0].reason}`);
    const description = describeSimulation(snapshot, {scenePath, mode, capabilities: rapierCapabilities(R)});
    const {scene, metersPerUnit: mpu} = description;
    const direction = scene?.gravityDirection || (snapshot.upAxis === 'Z' ? [0, 0, -1] : [0, -1, 0]);
    const magnitude = scene?.gravityMagnitude !== undefined && Number.isFinite(scene.gravityMagnitude) && scene.gravityMagnitude >= 0 ? scene.gravityMagnitude : 9.81 / mpu;
    const gravity = new Vector3().fromArray(direction).normalize().multiplyScalar(magnitude);
    const ownsWorld = !worldContext;
    const world = worldContext?.world || new R.World(mode === 'interaction' ? {x:0,y:0,z:0} : gravity);
    // Rapier dispatches contact hooks only through stepWithEvents.
    const events = ownsWorld ? new R.EventQueue(true) : worldContext.events;
    if (ownsWorld) { world.timestep = 1 / 120; world.lengthUnit = 1 / mpu; world.numSolverIterations = 12; }
    // Joint inspection does not solve contacts or require PhysX SDF colliders
    // or a reduced-coordinate articulation. Its dependent joints still share
    // one constraint solver, including closed loops and fixed attachments.
    const unsupported = initialIssues;
    /** @param {{path:string,type?:string}} item @param {string} reason */
    const warn = (item, reason) => {if(!unsupported.some(issue=>issue.path===item.path&&issue.reason===reason))unsupported.push({ path: item.path, type: item.type, reason });};
    for (const issue of description.issues) warn(issue, issue.reason);
    /** @type {Simulation<W,B>['backend']} */
    const backend = {name:'rapier',jointSolver:'impulse',adaptations:[]};
    /** @type {import('./rapierAsset.js').RapierAsset<B>|undefined} */
    let asset;
    const bindingAbort = new AbortController();
    /** @type {VisualBinding | undefined} */
    let visuals;
    /** @type {(()=>void)|undefined} */
    let unregister;
    /** @type {(()=>void)|undefined} */
    let unregisterResources;
    let released = false, visualsDisposed = false;
    const release = () => {
        // A pending binding can resolve after host disposal. Its registration
        // cleanup still runs, without touching the already released world.
        let cleanupError;
        if (visuals && !visualsDisposed) {
            visualsDisposed = true;
            try { visuals.dispose?.(); } catch (error) { cleanupError = error; }
        }
        if (released) { if (cleanupError) throw cleanupError; return; }
        released = true;
        bindingAbort.abort();
        unregister?.();
        unregisterResources?.();
        if (ownsWorld) { try{events?.free();}finally{world.free();} }
        else asset?.remove();
        if (cleanupError) throw cleanupError;
    };
    unregisterResources = worldContext?.trackResources(() => {try{visuals?.reset();}finally{release();}});

    try {
        asset = buildRapierAsset({rapier: R, world, description, warn});
        backend.jointSolver = asset.jointSolver;
        const articulationAdaptations = asset.adaptations.filter(item => item.source === 'reduced-coordinate articulation');
        backend.adaptations.push(...articulationAdaptations, ...description.adaptations, ...asset.adaptations.filter(item => !articulationAdaptations.includes(item)));
        /** @type {SimulationBodies<B>} */
        const bodies = new Map();
        for (const [path, body] of asset.bodies) bodies.set(path, {data: /** @type {PhysicsBody} */ (description.bodyData.get(path)), body, colliders: []});
        /** @type {SimulationColliders<B>} */
        const colliders = new Map();
        for (const [path, collider] of asset.colliders) {
            const record = /** @type {import('./description.js').ColliderData} */ (description.colliderData.get(path));
            const owner = bodies.get(record.owner?.path ?? '');
            colliders.set(collider.handle, {data: record.data, collider, owner});
            owner?.colliders.push(collider);
        }
        /** @type {SimulationHooks} */
        const hooks = {
            filterContactPair(a, b) {
                const c0 = colliders.get(a), c1 = colliders.get(b);
                return c0 && c1 && !description.shouldCollide(c0.data.path, c1.data.path) ? null : R.SolverFlags.COMPUTE_IMPULSE;
            },
            filterIntersectionPair() { return true; },
        };
        if(!allowPartial && unsupported.length)throw new Error(`Simulation unavailable: ${unsupported[0].reason}${unsupported.length>1?` (${unsupported.length} unsupported features)`:''}`);
        const {ownedBodies, ownedColliders} = asset;
        // Pending visual setup must not expose an unregistered physical asset.
        if(worldContext){for(const body of ownedBodies)body.setEnabled(false);for(const collider of ownedColliders)collider.setEnabled(false);}
        const binding = await bindVisuals?.(bodies, warn, bindingAbort.signal, colliders) || emptyVisualBinding;
        visuals = binding;
        if(!allowPartial&&unsupported.length)throw new Error(`Simulation unavailable: ${unsupported[0].reason}`);
        if (worldContext?.isDisposed()) throw new Error('Simulation world is disposed.');
        const sync=binding.sync;
        unregister = worldContext?.register({hooks, sync});
        if(worldContext){for(const body of ownedBodies)body.setEnabled(true);for(const collider of ownedColliders)collider.setEnabled(true);for(const {body,data}of bodies.values())if(data.startsAsleep)body.sleep();}
        const built = asset;
        const runtime = createSimulationRuntime({snapshot, mode, bodies,
            joints: new Map([...description.jointData].filter(([path]) => built.joints.has(path))),
            binding, release, isReleased: () => released,
            backend: {
                hold: () => built.hold(), release: () => built.release(),
                setDriveTarget: (path, position, velocity) => built.setDriveTarget(path, position, velocity),
                beginDrag: (body, position, local, stiffness, damping) => built.beginDrag(body, position, local, stiffness, damping),
                pin: body => built.pin(body),
                ...ownsWorld && {
                    /** @param {number} [dt] */
                    step(dt) { if (dt !== undefined) world.timestep = dt; world.step(events, hooks); },
                    timestep: () => world.timestep,
                },
            }});
        return {world, bodies, colliders, joints: asset.joints, unsupported, backend, ...runtime};
    } catch (error) { try{visuals?.reset();}finally{release();} throw error; }
}

/** One host-owned contact world for independently loaded asset instances. */
/** @template {RigidBody} B
 * @template {World<B>} W
 * @param {{rapier:RapierModule<B,W>,world?:W,registerWorldExtension?:(extension:SimulationWorldExtension)=>()=>void,gravity?:PhysicsVector,timestep?:number,metersPerUnit?:number,kilogramsPerUnit?:number}} options
 * @returns {SimulationWorld<W,B>}
 */
export function createSimulationWorld({rapier: R, world: borrowedWorld, registerWorldExtension, gravity, timestep = 1 / 120, metersPerUnit = 1, kilogramsPerUnit = 1}) {
    gravity ||= [0,-9.81/metersPerUnit,0];
    if (!R?.World || !Number.isFinite(metersPerUnit) || !Number.isFinite(kilogramsPerUnit) || !(metersPerUnit > 0) || !(kilogramsPerUnit > 0) || !Number.isFinite(timestep) || timestep <= 0 || gravity.length !== 3 || !gravity.every(Number.isFinite)) throw new TypeError('Invalid Rapier world options.');
    if (borrowedWorld && !(borrowedWorld instanceof R.World)) throw new TypeError('Supply the Rapier module that created the borrowed world.');
    if (registerWorldExtension && !borrowedWorld) throw new TypeError('World extension registration requires a borrowed world.');
    const ownsWorld = !borrowedWorld;
    const world = borrowedWorld || new R.World(vector(gravity)), events = ownsWorld ? new R.EventQueue(true) : undefined;
    /** @type {Set<{hooks:SimulationHooks,sync():void}>} */
    const registrations = new Set();
    /** @type {Map<string,SimulationAsset<W,B>>} */
    const assets = new Map();
    /** @type {Set<string>} */
    const pending = new Set();
    /** @type {Set<()=>void>} */
    const resourceCleanup = new Set();
    if (ownsWorld) {world.timestep = timestep; world.lengthUnit = 1 / metersPerUnit; world.numSolverIterations = 12;}
    let disposed = false, nextId = 1;
    let freed=false;
    const finalize=()=>{if(ownsWorld&&disposed&&!pending.size&&!freed){freed=true;try{events?.free();}finally{world.free();}}};
    const active = () => {if (disposed) throw new Error('Simulation world is disposed.');};
    /** @type {SimulationHooks} */
    const hooks = {
        filterContactPair(a, b, body1, body2) {
            for (const entry of registrations) if (entry.hooks.filterContactPair(a, b, body1, body2) === null) return null;
            return R.SolverFlags.COMPUTE_IMPULSE;
        },
        filterIntersectionPair() {return true;},
    };
    /** @type {WorldContext<W>} */
    const context = {world, events, isDisposed: () => disposed,
        trackResources(cleanup) {resourceCleanup.add(cleanup); return () => resourceCleanup.delete(cleanup);},
        register(entry) {registrations.add(entry); return () => registrations.delete(entry);},
    };
    /** @type {(()=>void)|undefined} */
    let unregisterHost;
    const sync = () => {active(); for (const entry of registrations) entry.sync();};
    /** @type {SimulationWorld<W,B>} */
    const host = {
        world, assets, metersPerUnit, kilogramsPerUnit, ownsWorld, hooks, sync,
        async addAsset({snapshot, id = 'asset-' + nextId++, position, rotation, bindVisuals, ...options}) {
            active();
            if(options.mode&&options.mode!=='simulation')throw new Error('Shared worlds run dynamics; use createMechanism for posing.');
            if (assets.has(id) || pending.has(id)) throw new Error('Duplicate simulation asset: ' + id);
            pending.add(id);
            /** @type {Simulation<W,B>|undefined} */
            let runtime;
            try {
                validateSnapshot(snapshot);
                const issues=getSimulationLimitations(snapshot);
                if(!options.allowPartial&&issues.length)throw new Error(`Simulation unavailable: ${issues[0].reason}`);
                const resolved = transformSnapshot(snapshot, {metersPerUnit, kilogramsPerUnit, position, rotation});
                runtime = await createSimulation({...options, rapier: R, snapshot: resolved, bindVisuals, worldContext: context});
                if (disposed) {runtime.dispose(); throw new Error('Simulation world is disposed.');}
                const release = runtime.dispose.bind(runtime);
                let detached=false;
                runtime.dispose = () => {if(detached)return;detached=true;try{release();}finally{if(assets.get(id)===runtime)assets.delete(id);}};
                const asset = Object.assign(runtime,{id,snapshot:resolved});
                assets.set(id, asset);
                return asset;
            } finally {pending.delete(id);finalize();}
        },
        removeAsset(id) {active(); const runtime = assets.get(id); runtime?.dispose(); return !!runtime;},
        step(dt = timestep) {
            active();
            if (!ownsWorld) throw new Error('The host owns stepping of this borrowed simulation world.');
            if (!Number.isFinite(dt) || dt <= 0) throw new RangeError('Step duration must be positive and finite.');
            world.timestep = dt; world.step(events, hooks);
            sync();
        },
        dispose() {
            if (disposed) return;
            disposed=true;const errors=[];
            try{unregisterHost?.();}catch(error){errors.push(error);}
            for(const runtime of [...assets.values()])try{runtime.dispose();}catch(error){errors.push(error);}
            for(const cleanup of [...resourceCleanup])try{cleanup();}catch(error){errors.push(error);}
            try{finalize();}catch(error){errors.push(error);}
            if(errors.length)throw new AggregateError(errors,'Simulation world disposal failed.');
        },
    };
    if (registerWorldExtension) {
        try {unregisterHost = registerWorldExtension({hooks, afterStep: sync, dispose: () => host.dispose()});}
        catch (error) {host.dispose(); throw error;}
    }
    return host;
}

export {shiftInertiaToCenterOfMass} from './massProperties.js';
