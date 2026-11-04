/** Bind explicit body identities to objects or individual render instances. */
/** @template {BodyPose} B
 * @param {{root:Object3D,bodies:ReadonlyMap<string,{data:PhysicsBody,body:B}>,bindings:ObjectBinding[],worldSpace?:boolean}} options
 */
export function bindVisuals<B extends BodyPose>({ root, bodies, bindings, worldSpace }: {
    root: Object3D;
    bodies: ReadonlyMap<string, {
        data: PhysicsBody;
        body: B;
    }>;
    bindings: ObjectBinding[];
    worldSpace?: boolean;
}): {
    root: import("three").Object3D<import("three").Object3DEventMap>;
    bindings: {
        object: Object3D;
        body: string;
        instanceIndex?: number | null;
    }[];
    sync: () => void;
    reset: () => void;
    /** @param {Object3D} object @param {number} [instanceIndex] */
    bodyForObject(object: Object3D, instanceIndex?: number): {
        data: PhysicsBody;
        body: B;
    } | null;
};
/** Place stage-local render geometry into a host world's Y-up coordinate frame. */
/** @param {Object3D} root @param {import('./index.js').PhysicsSnapshot} snapshot
 * @param {{metersPerUnit:number}} world
 * @param {{position?:import('./index.js').PhysicsVector,rotation?:import('./index.js').PhysicsRotation}} [options]
 */
export function placeAssetRoot(root: Object3D, snapshot: import("./index.js").PhysicsSnapshot, world: {
    metersPerUnit: number;
}, { position, rotation }?: {
    position?: import("./index.js").PhysicsVector;
    rotation?: import("./index.js").PhysicsRotation;
}): {
    reset(): void;
};
/** A render root has one controller, including while asynchronous setup runs. */
/** @template {{dispose():void}} T
 * @param {Object3D} root @param {()=>T|Promise<T>} create @returns {Promise<T>}
 */
export function withVisualController<T extends {
    dispose(): void;
}>(root: Object3D, create: () => T | Promise<T>): Promise<T>;
export { createJointHelpers } from "./three/jointHelpers.js";
export type Object3D = import("three").Object3D;
export type BodyPose = import("./kinematics.js").BodyPose;
export type Mechanism = import("./kinematics.js").Mechanism;
export type PhysicsBody = import("./index.js").PhysicsBody;
export type ObjectBinding = {
    object: Object3D;
    body: string;
    instanceIndex?: number | null;
};
