/** Bounded USD joint manipulation. The optional IK core has no physics/WASM runtime. */
/** @param {MechanismOptions} options */
export function createMechanism({ snapshot, bindVisuals, loadKinematics, dragMode, framePolicy }: MechanismOptions): Promise<{
    mode: "interaction";
    bodies: Map<string, BodyRecord>;
    joints: Map<string, JointRecord>;
    unsupported: import("./index.js").PhysicsIssue[];
    adaptations: import("./description.js").Adaptation[];
    roots: string[];
    metersPerUnit: number;
    play(): void;
    pause(): void;
    isPlaying: () => boolean;
    /** Let joints with authored drives relax toward their targets while nothing holds them.
     * Call once per frame with the elapsed seconds; returns whether any joint moved.
     * @param {number} [dt] */
    update(dt?: number): boolean;
    /** @param {string} path */
    getJointValue(path: string): number | null;
    /** @param {string} path @param {number} next */
    setJointValue(path: string, next: number): boolean;
    /** @param {string} path */
    getJointRotation(path: string): import("three").QuaternionTuple | null;
    /** @param {string} path @param {import('./index.js').PhysicsRotation} next */
    setJointRotation(path: string, next: import("./index.js").PhysicsRotation): boolean;
    jointForBody: (path: string) => JointRecord | null;
    /** Whether `beginDrag` would accept this body now. @param {string} path */
    canDrag(path: string): boolean;
    /** @param {import('three').Object3D} object @param {number} [index] */
    bodyForObject(object: import("three").Object3D, index?: number): {
        data: import("./rapier.js").PhysicsBody;
    } | null | undefined;
    /** @param {string} path @param {import('three').Vector3Like} position */
    beginDrag(path: string, position: import("three").Vector3Like): boolean;
    /** @param {import('three').Vector3Like} position */
    moveDrag(position: import("three").Vector3Like): void;
    endDrag(): void;
    reset(): void;
    dispose(): void;
}>;
export type PhysicsBody = import("./index.js").PhysicsBody;
export type PhysicsJoint = import("./index.js").PhysicsJoint;
export type PhysicsSnapshot = import("./index.js").PhysicsSnapshot;
export type PhysicsIssue = import("./index.js").PhysicsIssue;
export type BodyPose = {
    translation(): {
        x: number;
        y: number;
        z: number;
    };
    rotation(): {
        x: number;
        y: number;
        z: number;
        w: number;
    };
    isDynamic(): boolean;
};
export type MechanismBodies = Map<string, {
    data: PhysicsBody;
    body: BodyPose;
}>;
export type Link = import("./kinematics-types.js").Link;
export type Joint = import("./kinematics-types.js").Joint;
export type VisualBinding = import("./rapier.js").VisualBinding;
export type BodyRecord = {
    data: PhysicsBody;
    body: BodyPose;
    link: Link;
    position: Vector3;
    rotation: Quaternion;
};
export type JointRecord = {
    data: PhysicsJoint;
    joint: Joint;
    sign: number;
    angular: boolean;
    dof: number | null;
    parent: string;
    child: string;
    closure: boolean;
    lower: number;
    upper: number;
    initial: number;
    rotationDofs: number[];
    initialRotation: Quaternion | null;
};
export type Mechanism = Awaited<ReturnType<typeof createMechanism>>;
export type MechanismOptions = {
    snapshot: PhysicsSnapshot;
    dragMode?: "joint" | "point";
    loadKinematics?: () => Promise<unknown>;
    framePolicy?: "strict" | "preserve-rest";
    bindVisuals?: (bodies: MechanismBodies, warn: (item: {
        path: string;
        type?: string;
    }, reason: string) => void) => VisualBinding | Promise<VisualBinding>;
};
import { Vector3 } from 'three';
import { Quaternion } from 'three';
