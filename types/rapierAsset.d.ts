/**
 * Create the bodies, colliders and joints of a description in a Rapier world.
 * The standalone adapter uses this builder. The Needle adapter passes the same description to Engine's createAsset.
 */
/** @template {RigidBody} B
 * @template {World<B>} W
 * @param {{rapier:RapierModule<B,W>,world:W,description:SimulationDescription,warn:(item:{path:string,type?:string},reason:string)=>void}} options
 * @returns {RapierAsset<B>}
 */
export function buildRapierAsset<B extends RigidBody, W extends World<B>>({ rapier: R, world, description, warn }: {
    rapier: RapierModule<B, W>;
    world: W;
    description: SimulationDescription;
    warn: (item: {
        path: string;
        type?: string;
    }, reason: string) => void;
}): RapierAsset<B>;
export type RigidBody = import("./rapier-types.js").RigidBody;
export type Collider = import("./rapier-types.js").Collider;
export type Joint = import("./rapier-types.js").Joint;
export type Vector = import("./rapier-types.js").Vector;
export type SimulationDescription = import("./description.js").SimulationDescription;
export type MassDescription = import("./description.js").MassDescription;
export type World<B extends RigidBody = import("./rapier-types.js").RigidBody> = import("./rapier-types.js").World<B>;
export type RapierModule<B extends RigidBody = import("./rapier-types.js").RigidBody, W extends World<B> = World<B>> = import("./rapier-types.js").RapierModule<B, W>;
export type RapierAsset<B> = {
    bodies: Map<string, B>;
    colliders: Map<string, Collider>;
    joints: Map<string, Joint>;
    jointSolver: "impulse" | "hybrid";
    adaptations: import("./description.js").Adaptation[];
    ownedBodies: Set<B>;
    ownedColliders: Set<Collider>;
    setDriveTarget(path: string, position: number, velocity: number): boolean;
    hold(): void;
    release(): void;
    beginDrag(body: B, position: Vector, local: Vector, stiffness: number, damping: number): {
        move(position: Vector): void;
        end(): void;
    };
    pin(body: B): () => void;
    updateCouplings(): void;
    jointPosition(path: string): number | null;
    resetCoordinates(): void;
    remove(): void;
};
