/**
 * Play, pause, reset, joint drives and dragging. The standalone and Needle adapters both use this.
 * Joint values and targets are in the snapshot's units, with angles in degrees.
 */
/** @template {RuntimeBody} B
 * @param {{snapshot:PhysicsSnapshot,mode:'simulation'|'interaction',
 * bodies:ReadonlyMap<string,{data:PhysicsBody,body:B}>,joints:ReadonlyMap<string,PhysicsJoint>,
 * backend:RuntimeBackend<B>,binding:RuntimeBinding,release():void,isReleased():boolean}} options
 */
export function createSimulationRuntime<B extends RuntimeBody>({ snapshot, mode, bodies, joints, backend, binding, release, isReleased }: {
    snapshot: PhysicsSnapshot;
    mode: "simulation" | "interaction";
    bodies: ReadonlyMap<string, {
        data: PhysicsBody;
        body: B;
    }>;
    joints: ReadonlyMap<string, PhysicsJoint>;
    backend: RuntimeBackend<B>;
    binding: RuntimeBinding;
    release(): void;
    isReleased(): boolean;
}): {
    play(): void;
    pause(): void;
    isPlaying: () => boolean;
    /** @param {number} dt */
    update(dt: number): void;
    /** @param {number} [dt] */
    step(dt?: number): void;
    reset: () => void;
    /** @param {string} path */
    getJointValue(path: string): number | null;
    /** @param {string} path @param {{position?:number,velocity?:number}} [target] */
    setJointTarget(path: string, { position, velocity }?: {
        position?: number;
        velocity?: number;
    }): boolean;
    /** @param {unknown} object @param {number} [instanceIndex] */
    bodyForObject: (object: unknown, instanceIndex?: number) => unknown;
    /** @param {string} path @param {Vector} position */
    beginDrag(path: string, position: Vector): boolean;
    /** @param {Vector} position */
    moveDrag(position: Vector): void;
    endDrag: () => void;
    dispose(): void;
};
export type PhysicsSnapshot = import("./index.js").PhysicsSnapshot;
export type PhysicsBody = import("./index.js").PhysicsBody;
export type PhysicsJoint = import("./index.js").PhysicsJoint;
export type PhysicsDrive = import("./index.js").PhysicsDrive;
export type Vector = import("./rapier-types.js").Vector;
export type Rotation = import("./rapier-types.js").Rotation;
/**
 * The body methods the runtime calls. Rapier bodies already have them.
 */
export type RuntimeBody = {
    translation(): Vector;
    rotation(): Rotation;
    mass(): number;
    isDynamic(): boolean;
    setTranslation(value: Vector, wake: boolean): void;
    setRotation(value: Rotation, wake: boolean): void;
    setLinvel(value: Vector, wake: boolean): void;
    setAngvel(value: Vector, wake: boolean): void;
    resetForces(wake: boolean): void;
    resetTorques(wake: boolean): void;
    sleep(): void;
};
/**
 * What the runtime needs from a physics backend. Drive targets are in radians and world length units.
 */
export type RuntimeBackend<B extends RuntimeBody> = {
    hold(): void;
    release(): void;
    setDriveTarget(path: string, position: number, velocity: number): boolean;
    beginDrag(body: B, position: Vector, local: Vector, stiffness: number, damping: number): {
        move(position: Vector): void;
        end(): void;
    };
    pin?(body: B): () => void;
    step?(dt?: number): void;
    timestep?(): number;
};
export type RuntimeBinding = {
    sync(): void;
    reset(): void;
    bodyForObject(object: unknown, instanceIndex?: number): unknown;
};
