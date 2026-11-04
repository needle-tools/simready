/** @param {unknown} value @returns {value is EnginePhysics} */
export function supportsExternalPhysics(value: unknown): value is EnginePhysics;
export type Context = import("@needle-tools/engine").Context;
export type Rigidbody = import("@needle-tools/engine").Rigidbody;
export type Collider = import("@needle-tools/engine").Collider;
export type World = NonNullable<import("@needle-tools/engine").RapierPhysics["world"]>;
export type RigidBody = ReturnType<World["createRigidBody"]>;
export type ExternalRegistration = {
    readonly rigidbodies: ReadonlyMap<number, Rigidbody>;
    readonly colliders: ReadonlyMap<number, Collider>;
    dispose(): void;
};
/**
 * The bridge checks these capabilities because released Engine versions may
 * predate external registration, despite exposing the same Rapier world.
 */
export type EnginePhysics = {
    world: World | undefined;
    initialize(): void | Promise<void>;
    registerWorldExtension(extension: import("../rapier.js").SimulationWorldExtension): () => void;
    registerExternalPhysics(options: {
        root: import("three").Object3D;
        syncTransforms: boolean;
        bodies: {
            body: import("../rapier-types.js").RigidBody;
            object?: import("three").Object3D;
        }[];
        colliders: {
            collider: import("../rapier-types.js").Collider;
            object?: import("three").Object3D;
        }[];
        onDestroy(): void;
    }): ExternalRegistration;
};
