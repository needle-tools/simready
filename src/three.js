import {Matrix4, Quaternion, Vector3} from 'three';

const unit = new Vector3(1, 1, 1);
const pose = body => new Matrix4().compose(new Vector3().copy(body.translation()), new Quaternion().copy(body.rotation()), unit);

/** Bind explicit body identities to objects or individual render instances. */
export function bindVisuals({root, bodies, bindings, worldSpace = false}) {
    if (!root?.isObject3D || !Array.isArray(bindings)) throw new TypeError('Visual binding requires a Three root and explicit bindings.');
    const records = [], byObject = new WeakMap();
    root.updateWorldMatrix(true, true);
    const inverseRoot = root.matrixWorld.clone().invert();
    for (const {object, body, instanceIndex} of bindings) {
        const owner = bodies.get(body);
        if (!owner || !object?.isObject3D) throw new Error('Visual binding references an unavailable body or object: ' + body);
        const index = object.isInstancedMesh ? instanceIndex ?? 0 : null;
        if (index !== null && (!Number.isInteger(index) || index < 0 || index >= object.count)) throw new RangeError('Invalid visual instance index.');
        const original = new Matrix4();
        if (index !== null) object.getMatrixAt(index, original); else original.copy(object.matrix);
        const world = index !== null ? object.matrixWorld.clone().multiply(original) : object.matrixWorld;
        const bodyPose = pose(owner.body);
        const offset = bodyPose.invert().multiply(worldSpace ? new Matrix4() : inverseRoot).multiply(world);
        records.push({object, index, owner, original, offset, autoUpdate: object.matrixAutoUpdate});
        let identities = byObject.get(object); if (!identities) byObject.set(object, identities = new Map());
        identities.set(index ?? 0, owner);
    }
    function update(reset = false) {
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
        sync: () => update(), reset: () => update(true),
        bodyForObject(object, instanceIndex) {
            for (let current = object; current; current = current.parent) {
                const owner = byObject.get(current)?.get(current.isInstancedMesh ? instanceIndex ?? 0 : 0);
                if (owner?.body.isDynamic()) return owner;
            }
            return null;
        },
    };
}

export {createJointHelpers} from './three/jointHelpers.js';

/** Place stage-local render geometry into a host world's Y-up coordinate frame. */
export function placeAssetRoot(root,snapshot,world,{position=[0,0,0],rotation=[0,0,0,1]}={}) {
    const length=(snapshot.metersPerUnit>0?snapshot.metersPerUnit:.01)/world.metersPerUnit;
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

const visualOwners=new WeakMap();
/** A render root has one controller, including while asynchronous setup runs. */
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
