// @ts-check

/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('./kinematics.js').BodyPose} BodyPose */
/** @typedef {import('./kinematics.js').Mechanism} Mechanism */
/** @typedef {import('./index.js').PhysicsBody} PhysicsBody */
/** @typedef {{object:Object3D;
body:string;
instanceIndex?:number|null}} ObjectBinding */

import {Matrix4, Quaternion, Vector3} from 'three';

/** @param {Object3D} object @returns {object is import('three').InstancedMesh} */
const isInstanced = object => 'isInstancedMesh' in object && object.isInstancedMesh === true;

const unit = new Vector3(1, 1, 1);
/** @param {BodyPose} body */
const pose = body => new Matrix4().compose(new Vector3().copy(body.translation()), new Quaternion().copy(body.rotation()), unit);

/** Bind explicit body identities to objects or individual render instances. */
/** @template {BodyPose} B
 * @param {{root:Object3D,bodies:ReadonlyMap<string,{data:PhysicsBody,body:B}>,bindings:ObjectBinding[],worldSpace?:boolean}} options
 */
export function bindVisuals({root, bodies, bindings, worldSpace = false}) {
    if (!root?.isObject3D || !Array.isArray(bindings)) throw new TypeError('Visual binding requires a Three root and explicit bindings.');
    /** @typedef {{owner:{data:PhysicsBody,body:B},original:Matrix4,offset:Matrix4,autoUpdate:boolean}} RecordState */
    /** @type {Array<RecordState & ({object:import('three').InstancedMesh,index:number}|{object:Object3D,index:null})>} */
    const records = [];
    /** @type {WeakMap<Object3D,Map<number,{data:PhysicsBody,body:B}>>} */
    const byObject = new WeakMap();
    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    for (const {object, body, instanceIndex} of bindings) {
        const owner = bodies.get(body);
        if (!owner || !object?.isObject3D) throw new Error('Visual binding references an unavailable body or object: ' + body);
        const index = isInstanced(object) ? instanceIndex ?? 0 : null;
        if (index !== null && (!Number.isInteger(index) || index < 0 || (!isInstanced(object) || index >= object.count))) throw new RangeError('Invalid visual instance index.');
        const original = new Matrix4();
        if (index !== null && isInstanced(object)) object.getMatrixAt(index, original); else original.copy(object.matrix);
        const world = index !== null ? object.matrixWorld.clone().multiply(original) : object.matrixWorld;
        const bodyPose = pose(owner.body);
        const offset = bodyPose.invert().multiply(worldSpace ? new Matrix4() : inverseRoot).multiply(world);
        const state = {owner, original, offset, autoUpdate:object.matrixAutoUpdate};
        records.push(isInstanced(object) ? {...state,object,index:instanceIndex??0} : {...state,object,index:null});
        let identities = byObject.get(object); if (!identities) byObject.set(object, identities = new Map());
        identities.set(index ?? 0, owner);
    }
    function update(reset = false) {
        /** @type {Set<import('three').InstancedMesh>} */
        const changed = new Set();
        root.updateWorldMatrix(true, false);
        for (const {object, index, owner, original, offset, autoUpdate} of records) {
            let target = original;
            if (!reset) {
                object.parent?.updateWorldMatrix(true, false);
                target = (worldSpace ? new Matrix4() : root.matrixWorld.clone()).multiply(pose(owner.body)).multiply(offset);
                if (index !== null) {object.updateWorldMatrix(true, false); target.premultiply(object.matrixWorld.clone().invert());}
                else if (object.parent) target.premultiply(object.parent.matrixWorld.clone().invert());
            }
            if (index !== null) {object.setMatrixAt(index, target); changed.add(object);}
            else {object.matrix.copy(target); object.matrixAutoUpdate = reset ? autoUpdate : false; object.matrixWorldNeedsUpdate = true;}
        }
        for (const object of changed) {object.instanceMatrix.needsUpdate = true; object.computeBoundingSphere(); if (object.boundingBox) object.computeBoundingBox();}
    }
    return {
        root, bindings: bindings.map(binding => ({...binding})),
        sync: () => update(), reset: () => update(true),
        /** @param {Object3D} object @param {number} [instanceIndex] */
        bodyForObject(object, instanceIndex) {
            /** @type {Object3D|null} */
            let current = object;
            for (; current; current = current.parent) {
                const owner = byObject.get(current)?.get(isInstanced(current) ? instanceIndex ?? 0 : 0);
                if (owner) return owner;
            }
            return null;
        },
    };
}

export {createJointHelpers} from './three/jointHelpers.js';

/** Place stage-local render geometry into a host world's Y-up coordinate frame. */
/** @param {Object3D} root @param {import('./index.js').PhysicsSnapshot} snapshot
 * @param {{metersPerUnit:number}} world
 * @param {{position?:import('./index.js').PhysicsVector,rotation?:import('./index.js').PhysicsRotation}} [options]
 */
export function placeAssetRoot(root,snapshot,world,{position=[0,0,0],rotation=[0,0,0,1]}={}) {
    const length=((snapshot.metersPerUnit??0)>0?snapshot.metersPerUnit??.01:.01)/world.metersPerUnit;
    if(position.length!==3||rotation.length!==4||![...position,...rotation,length].every(Number.isFinite)||length<=0||!rotation.some(Boolean))throw new RangeError('Invalid asset placement.');
    root.updateWorldMatrix(true,false);
    const original=root.matrix.clone(),autoUpdate=root.matrixAutoUpdate;
    const up=snapshot.upAxis==='Z'?new Vector3(0,0,1):snapshot.upAxis==='X'?new Vector3(1,0,0):new Vector3(0,1,0);
    const basis=new Quaternion(...rotation).normalize().multiply(new Quaternion().setFromUnitVectors(up,new Vector3(0,1,0)));
    const target=new Matrix4().compose(new Vector3(...position),basis,new Vector3(length,length,length));
    if(root.parent)target.premultiply(root.parent.matrixWorld.clone().invert());
    root.matrixAutoUpdate=false;root.matrix.copy(target);root.matrixWorldNeedsUpdate=true;
    return {reset(){root.matrix.copy(original);root.matrixAutoUpdate=autoUpdate;root.matrixWorldNeedsUpdate=true;}};
}

/** @type {WeakMap<Object3D,object>} */
const visualOwners=new WeakMap();
/** A render root has one controller, including while asynchronous setup runs. */
/** @template {{dispose():void}} T
 * @param {Object3D} root @param {()=>T|Promise<T>} create @returns {Promise<T>}
 */
export async function withVisualController(root,create){
    if(visualOwners.has(root))throw new Error('This asset already has an active or pending controller. Dispose it before switching.');
    const token={};visualOwners.set(root,token);
    const release=()=>{if(visualOwners.get(root)===token)visualOwners.delete(root);};
    try{
        const controller=await create(),dispose=controller.dispose.bind(controller);let disposed=false;
        controller.dispose=()=>{if(disposed)return;disposed=true;try{dispose();}finally{release();}};
        return controller;
    }catch(error){release();throw error;}
}
