/** @param {unknown} value @returns {value is EnginePhysics} */
export function supportsPhysicsAssets(value: unknown): value is EnginePhysics;
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type Vector = {
    x: number;
    y: number;
    z: number;
};
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type Rotation = Vector & {
    w: number;
};
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type EngineBody = {
    readonly id: string;
    readonly component: object;
    readonly isValid: boolean;
    type: "dynamic" | "kinematic" | "fixed";
    readonly isSleeping: boolean;
    readonly mass: number;
    getPosition(): Vector;
    getRotation(): Rotation;
    setPose(pose: {
        position?: Vector;
        rotation?: Rotation;
    }, wake?: boolean): void;
    setKinematicTarget(pose: {
        position?: Vector;
        rotation?: Rotation;
    }): void;
    getLinearVelocity(): Vector;
    setLinearVelocity(value: Vector, wake?: boolean): void;
    getAngularVelocity(): Vector;
    setAngularVelocity(value: Vector, wake?: boolean): void;
    resetForces(wake?: boolean): void;
    sleep(): void;
    wakeUp(): void;
};
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type EngineCollider = {
    readonly id: string;
    readonly body: EngineBody | null;
    readonly component: object;
    readonly isValid: boolean;
};
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type EngineJoint = {
    readonly id: string;
    readonly isValid: boolean;
    setDriveTarget(target: {
        position?: number;
        velocity?: number;
    }): boolean;
};
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type EngineAsset = {
    readonly bodies: ReadonlyMap<string, EngineBody>;
    readonly colliders: ReadonlyMap<string, EngineCollider>;
    readonly joints: ReadonlyMap<string, EngineJoint>;
    readonly issues: ReadonlyArray<{
        id: string;
        kind: string;
        reason: string;
    }>;
    readonly adaptations: ReadonlyArray<{
        id: string;
        source: string;
        target: string;
        reason: string;
    }>;
    readonly isDisposed: boolean;
    hold(): void;
    release(): void;
    dispose(): void;
};
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type EngineAssetDescription = {
    root?: import("three").Object3D;
    syncTransforms?: boolean;
    allowPartial?: boolean;
    bodies?: Array<import("../description.js").BodyDescription | {
        id: string;
        type: "kinematic";
        position: Vector;
    }>;
    colliders?: import("../description.js").ColliderDescription[];
    joints?: Array<import("../description.js").JointDescription | {
        id: string;
        type: "spring";
        body0: object;
        body1: string;
        anchor0: Vector;
        spring: {
            stiffness: number;
            damping: number;
        };
    }>;
    articulations?: import("../description.js").ArticulationDescription[];
    shouldCollide?(a: EngineCollider, b: EngineCollider): boolean;
    onAfterStep?(): void;
    onDestroy?(): void;
};
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type EnginePhysics = {
    initialize(): unknown;
    readonly capabilities?: import("../description.js").Capabilities;
    createAsset(description: EngineAssetDescription): EngineAsset;
    onWorldDisposed(callback: () => void): () => void;
};
/**
 * The parts of Needle Engine's physics asset API that SimReady uses.
 * They are declared here so SimReady's types also compile against Engine versions
 * that predate this API. createNeedleWorld checks for the API at runtime.
 */
export type NeedleBody = import("../simulationRuntime.js").RuntimeBody & {
    readonly handle: EngineBody | undefined;
    attach(handle: EngineBody): void;
    isValid(): boolean;
    linvel(): Vector;
    angvel(): Vector;
    isSleeping(): boolean;
    wakeUp(): void;
};
