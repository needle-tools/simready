/**
 * The adapter uses a structural protocol so hosts can supply their Rapier
 * version without sharing its private WASM wrapper types. Consumer checks cover
 * both the standalone module and Needle's module.
 */
export type Vector = {
    x: number;
    y: number;
    z: number;
};
/**
 * The adapter uses a structural protocol so hosts can supply their Rapier
 * version without sharing its private WASM wrapper types. Consumer checks cover
 * both the standalone module and Needle's module.
 */
export type Rotation = Vector & {
    w: number;
};
export type RigidBody = {
    handle: number;
    translation(): Vector;
    rotation(): Rotation;
    linvel(): Vector;
    angvel(): Vector;
    nextTranslation(): Vector;
    nextRotation(): Rotation;
    mass(): number;
    localCom(): Vector;
    principalInertia(): Vector;
    principalInertiaLocalFrame(): Rotation;
    bodyType(): number;
    isDynamic(): boolean;
    isEnabled(): boolean;
    isSleeping(): boolean;
    setTranslation(value: Vector, wake: boolean): void;
    setRotation(value: Rotation, wake: boolean): void;
    setLinvel(value: Vector, wake: boolean): void;
    setAngvel(value: Vector, wake: boolean): void;
    setNextKinematicTranslation(value: Vector): void;
    setNextKinematicRotation(value: Rotation): void;
    setBodyType(type: number, wake: boolean): void;
    setEnabled(enabled: boolean): void;
    setAdditionalSolverIterations(iterations: number): void;
    setAdditionalMassProperties(mass: number, com: Vector, inertia: Vector, frame: Rotation, wake: boolean): void;
    recomputeMassPropertiesFromColliders(): void;
    resetForces(wake: boolean): void;
    resetTorques(wake: boolean): void;
    sleep(): void;
    wakeUp(): void;
};
export type Collider = {
    handle: number;
    setEnabled(enabled: boolean): void;
    setDensity(density: number): void;
};
export type Joint = {
    handle: number;
    setContactsEnabled(enabled: boolean): void;
    setLocalFrame1?: (position: Vector, rotation: Rotation) => void;
    setLocalFrame2?: (position: Vector, rotation: Rotation) => void;
    setLimits?: (lower: number, upper: number) => void;
    configureMotorModel?: (model: number) => void;
    configureMotor?: (position: number, velocity: number, stiffness: number, damping: number) => void;
    setMotorMaxForce?: (force: number) => void;
};
export type RigidBodyDescriptor = {
    setTranslation(x: number, y: number, z: number): RigidBodyDescriptor;
    setRotation(value: Rotation): RigidBodyDescriptor;
    setLinvel(x: number, y: number, z: number): RigidBodyDescriptor;
    setAngvel(value: Vector): RigidBodyDescriptor;
    setSleeping(value: boolean): RigidBodyDescriptor;
    setCcdEnabled(value: boolean): RigidBodyDescriptor;
};
export type ColliderDescriptor = {
    setTranslation(x: number, y: number, z: number): ColliderDescriptor;
    setRotation(value: Rotation): ColliderDescriptor;
    setFriction(value: number): ColliderDescriptor;
    setRestitution(value: number): ColliderDescriptor;
    setDensity(value: number): ColliderDescriptor;
    setMass(value: number): ColliderDescriptor;
    setMassProperties(mass: number, com: Vector, inertia: Vector, frame: Rotation): ColliderDescriptor;
    setActiveHooks(hooks: number): ColliderDescriptor;
};
/**
 * Joint descriptions are opaque to the adapter and belong to the supplied module.
 */
export type JointDescriptor = object;
export type EventQueue = {
    free(): void;
};
export type PhysicsHooks = {
    filterContactPair(a: number, b: number, body1: number, body2: number): number | null;
    filterIntersectionPair(a: number, b: number, body1: number, body2: number): boolean;
};
export type World<B extends RigidBody = RigidBody> = {
    timestep: number;
    lengthUnit: number;
    numSolverIterations: number;
    bodies: {
        contains(handle: number): boolean;
    };
    colliders: {
        contains(handle: number): boolean;
    };
    impulseJoints: {
        contains(handle: number): boolean;
    };
    multibodyJoints: {
        contains(handle: number): boolean;
    };
    createRigidBody(desc: RigidBodyDescriptor): B;
    createCollider(desc: ColliderDescriptor, body?: B): Collider;
    createImpulseJoint(desc: JointDescriptor, a: B, b: B, wake: boolean): Joint;
    createMultibodyJoint(desc: JointDescriptor, a: B, b: B, wake: boolean): Joint;
    removeRigidBody(body: B): void;
    removeCollider(collider: Collider, wake: boolean): void;
    removeImpulseJoint(joint: Joint, wake: boolean): void;
    removeMultibodyJoint(joint: Joint, wake: boolean): void;
    step(events?: EventQueue, hooks?: PhysicsHooks): void;
    free(): void;
};
export type RapierModule<B extends RigidBody = RigidBody, W extends World<B> = World<B>> = {
    World: new (gravity: Vector) => W;
    RigidBody: {
        prototype: B;
    };
    EventQueue: new (autoDrain: boolean) => EventQueue;
    RigidBodyDesc: {
        dynamic(): RigidBodyDescriptor;
        fixed(): RigidBodyDescriptor;
        kinematicPositionBased(): RigidBodyDescriptor;
    };
    ColliderDesc: {
        cuboid(x: number, y: number, z: number): ColliderDescriptor;
        ball(radius: number): ColliderDescriptor;
        capsule(halfHeight: number, radius: number): ColliderDescriptor;
        cylinder(halfHeight: number, radius: number): ColliderDescriptor;
        cone(halfHeight: number, radius: number): ColliderDescriptor;
        halfspace?: (normal: Vector) => ColliderDescriptor;
        convexHull(points: Float32Array): ColliderDescriptor | null;
        convexDecomposition?: (points: Float32Array, indices: Uint32Array, options: {
            resolution: number;
            concavity: number;
            maxConvexHulls: number;
        }, flags: number) => ColliderDescriptor | null;
        trimesh(points: Float32Array, indices: Uint32Array, flags?: number): ColliderDescriptor;
    };
    JointData: {
        fixed(a: Vector, qa: Rotation, b: Vector, qb: Rotation): JointDescriptor;
        spherical(a: Vector, b: Vector): JointDescriptor;
        revolute(a: Vector, b: Vector, axis: Vector): JointDescriptor;
        prismatic(a: Vector, b: Vector, axis: Vector): JointDescriptor;
        rope(length: number, a: Vector, b: Vector): JointDescriptor;
        spring(length: number, stiffness: number, damping: number, a: Vector, b: Vector): JointDescriptor;
    };
    ImpulseJoint?: {
        prototype: Joint;
    };
    RigidBodyType: {
        Fixed: number;
    };
    MotorModel: {
        AccelerationBased: number;
        ForceBased: number;
    };
    SolverFlags: {
        COMPUTE_IMPULSE: number;
    };
    ActiveHooks: {
        FILTER_CONTACT_PAIRS: number;
    };
    TriMeshFlags: {
        FIX_INTERNAL_EDGES: number;
        FIX_INTERNAL_EDGES_TWO_SIDED?: number;
    };
    CompoundFlags?: {
        FIX_INTERNAL_EDGES: number;
    };
};
