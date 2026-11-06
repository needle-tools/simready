// @ts-check
/** @typedef {import('./index.js').PhysicsSnapshot} PhysicsSnapshot */
/** @typedef {import('./index.js').PhysicsBody} PhysicsBody */
/** @typedef {import('./index.js').PhysicsJoint} PhysicsJoint */
/** @typedef {import('./index.js').PhysicsDrive} PhysicsDrive */
/** @typedef {import('./rapier-types.js').Vector} Vector */
/** @typedef {import('./rapier-types.js').Rotation} Rotation */
/**
 * The body methods the runtime calls. Rapier bodies already have them.
 * @typedef {{
 * translation():Vector; rotation():Rotation; mass():number; isDynamic():boolean;
 * setTranslation(value:Vector,wake:boolean):void; setRotation(value:Rotation,wake:boolean):void;
 * setLinvel(value:Vector,wake:boolean):void; setAngvel(value:Vector,wake:boolean):void;
 * resetForces(wake:boolean):void; resetTorques(wake:boolean):void; sleep():void;
 * }} RuntimeBody
 */
/**
 * What the runtime needs from a physics backend. Drive targets are in radians and world length units.
 * @template {RuntimeBody} B
 * @typedef {{
 * hold():void; release():void;
 * jointPosition?(path:string):number|null; resetCoordinates?():void;
 * setDriveTarget(path:string,position:number,velocity:number):boolean;
 * beginDrag(body:B,position:Vector,local:Vector,stiffness:number,damping:number):{move(position:Vector):void,end():void};
 * pin?(body:B):()=>void;
 * step?(dt?:number):void; timestep?():number;
 * }} RuntimeBackend
 */
/** @typedef {{sync():void,reset():void,bodyForObject(object:unknown,instanceIndex?:number):unknown}} RuntimeBinding */

import {Quaternion, Vector3} from 'three';
import {jointValue} from './jointCoordinates.js';

/** @param {import('./index.js').PhysicsVector} [a] */
const vector = (a = [0, 0, 0]) => ({x: a[0], y: a[1], z: a[2]});
/** @param {import('./index.js').PhysicsRotation} [a] */
const rotation = (a = [0, 0, 0, 1]) => ({x: a[0], y: a[1], z: a[2], w: a[3]});
/** @param {PhysicsJoint} data */
const unitOf = data => data.type === 'revolute' ? Math.PI / 180 : 1;

/**
 * Play, pause, reset, joint drives and dragging. The standalone and Needle adapters both use this.
 * Joint values and targets are in the snapshot's units, with angles in degrees.
 */
/** @template {RuntimeBody} B
 * @param {{snapshot:PhysicsSnapshot,mode:'simulation'|'interaction',
 * bodies:ReadonlyMap<string,{data:PhysicsBody,body:B}>,joints:ReadonlyMap<string,PhysicsJoint>,
 * backend:RuntimeBackend<B>,binding:RuntimeBinding,release():void,isReleased():boolean}} options
 */
export function createSimulationRuntime({snapshot, mode, bodies, joints, backend, binding, release, isReleased}) {
    const ownsWorld = !!backend.step;
    let playing = false, released = false, accumulator = 0, held = false;
    // The host may free our physics objects on its own, for example when its world is disposed.
    const gone = () => released || isReleased();
    /** @type {{handle:{move(position:Vector):void,end():void},pinned:Array<()=>void>}|null} */
    let drag = null;
    /** @type {Map<string,{data:PhysicsJoint,drive:PhysicsDrive|undefined}>} */
    const controls = new Map([...joints].map(([path, data]) => [path, {data, drive: data.drive ? {...data.drive} : undefined}]));
    function endDrag() {
        if (!drag) return;
        const {handle, pinned} = drag; drag = null;
        handle.end(); for (const restore of pinned) restore();
    }
    const pauseBodies = () => { if (held || gone()) return; held = true; backend.hold(); };
    const resumeBodies = () => { if (!held) return; held = false; backend.release(); };
    /** @param {string} path @param {PhysicsDrive} drive */
    const applyDrive = (path, drive) => {
        const unit = unitOf(/** @type {PhysicsJoint} */ (controls.get(path)?.data));
        return backend.setDriveTarget(path, drive.targetPosition * unit, drive.targetVelocity * unit);
    };
    function reset() {
        if (gone()) return;
        endDrag(); resumeBodies(); playing = false; accumulator = 0;
        for (const {body, data} of bodies.values()) {
            body.setTranslation(vector(data.position), true); body.setRotation(rotation(data.rotation), true);
            body.setLinvel(vector(data.linearVelocity), true);
            body.setAngvel(new Vector3().fromArray(data.angularVelocity || [0, 0, 0]).multiplyScalar(Math.PI / 180), true);
            body.resetForces(true); body.resetTorques(true);
            if (data.startsAsleep) body.sleep();
        }
        for (const [path, record] of controls) {
            if (!record.data.drive?.enabled) continue;
            record.drive = {...record.data.drive};
            applyDrive(path, record.drive);
        }
        backend.resetCoordinates?.();
        pauseBodies();
        binding.reset();
    }
    return {
        play() { if (!gone()) { resumeBodies(); playing = true; } },
        pause() { if (gone()) return; playing = false; endDrag(); pauseBodies(); },
        isPlaying: () => playing,
        /** @param {number} dt */
        update(dt) {
            if (!playing || gone() || !ownsWorld) return;
            accumulator += Math.min(0.1, Math.max(0, dt));
            const timestep = backend.timestep?.() ?? 1 / 120;
            while (accumulator >= timestep) { backend.step?.(); accumulator -= timestep; }
            binding.sync();
        },
        /** @param {number} [dt] */
        step(dt) {
            if (gone()) throw new Error('Simulation is disposed.');
            if (!ownsWorld) throw new Error('Step the owning simulation world.');
            const duration = dt ?? backend.timestep?.() ?? 1 / 120;
            if (!Number.isFinite(duration) || duration <= 0) throw new RangeError('Step duration must be positive and finite.');
            const wasHeld = held;
            if (wasHeld) resumeBodies();
            try { backend.step?.(duration); binding.sync(); }
            finally { if (wasHeld) pauseBodies(); }
        },
        reset,
        /** @param {string} path */
        getJointValue(path) {
            const record=controls.get(path);
            if(gone() || !record)return null;
            const coordinate=backend.jointPosition?.(path);
            return coordinate == null ? jointValue(record.data,bodies) : coordinate/unitOf(record.data);
        },
        /** @param {string} path @param {{position?:number,velocity?:number}} [target] */
        setJointTarget(path, {position, velocity} = {}) {
            const record = controls.get(path);
            if (gone() || !record?.drive?.enabled) return false;
            if (position !== undefined && !Number.isFinite(position) || velocity !== undefined && !Number.isFinite(velocity)) throw new RangeError('Motor targets must be finite.');
            const drive = {...record.drive, targetPosition: position ?? record.drive.targetPosition, targetVelocity: velocity ?? record.drive.targetVelocity};
            if (!applyDrive(path, drive)) return false;
            record.drive = drive; return true;
        },
        /** @param {unknown} object @param {number} [instanceIndex] */
        bodyForObject: (object, instanceIndex) => gone() ? null : binding.bodyForObject(object, instanceIndex),
        /** @param {string} path @param {Vector} position */
        beginDrag(path, position) {
            if (gone()) return false;
            endDrag();
            const body = bodies.get(path)?.body;
            if (!body?.isDynamic() || !playing) return false;
            const local = new Vector3().copy(position).sub(body.translation()).applyQuaternion(new Quaternion().copy(body.rotation()).invert());
            /** @type {Array<()=>void>} */
            const pinned = [];
            if (mode === 'interaction' && backend.pin) {
                // Hold the mechanism's base while inspecting a movable part.
                // All dependent links remain in the same solver.
                const connected = new Set([path]); let changed = true;
                while (changed) {
                    changed = false;
                    for (const item of snapshot.joints || []) {
                        if (!controls.has(item.path) || !connected.has(item.body0 ?? '') && !connected.has(item.body1 ?? '')) continue;
                        for (const target of [item.body0, item.body1]) if (target && !connected.has(target)) { connected.add(target); changed = true; }
                    }
                }
                const links = (snapshot.joints || []).filter(item => controls.has(item.path) && connected.has(item.body0 ?? ''));
                const roots = links.filter(item => !links.some(other => other.body1 === item.body0)).map(item => item.body0);
                const base = [...new Set(roots)].map(key => bodies.get(key ?? '')).find(item => item && item.body !== body);
                if (base?.body.isDynamic()) pinned.push(backend.pin(base.body));
            }
            // A rigid mouse constraint fights the mechanism's own limits when
            // the pointer moves beyond its range. A damped spring lets the grab
            // yield while the authored joints stay rigid.
            const mass = Math.max(body.mass(), 1e-6);
            try { drag = {handle: backend.beginDrag(body, position, local, 400 * mass, 40 * mass), pinned}; }
            catch (error) { for (const restore of pinned) restore(); throw error; }
            return true;
        },
        /** @param {Vector} position */
        moveDrag(position) { drag?.handle.move(position); },
        endDrag,
        dispose() {
            if (gone()) return;
            try { reset(); } finally { released = true; playing = false; release(); }
        },
    };
}
