/** Check the optional injected module at its loading boundary.
 * @param {()=>Promise<unknown>} [load] @returns {Promise<KinematicsModule>}
 */
export function loadKinematicsModule(load?: () => Promise<unknown>): Promise<KinematicsModule>;
/**
 * Minimum IK interface used by the mechanism adapter. The upstream declarations
 * use boxed numeric types and omit methods present in the pinned implementation.
 */
export type Frame = {
    name: string;
    matrixWorld: Float32Array;
    setPosition(x: number, y: number, z: number): void;
    setQuaternion(x: number, y: number, z: number, w: number): void;
    updateMatrixWorld(force?: boolean): void;
};
/**
 * Minimum IK interface used by the mechanism adapter. The upstream declarations
 * use boxed numeric types and omit methods present in the pinned implementation.
 */
export type Link = Frame & {
    addChild(child: Joint): void;
};
/**
 * Minimum IK interface used by the mechanism adapter. The upstream declarations
 * use boxed numeric types and omit methods present in the pinned implementation.
 */
export type Joint = Frame & {
    addChild(child: Link): void;
    makeClosure(child: Link): void;
    setDoF(dof: number): void;
    setDoFValue(dof: number, value: number): boolean;
    getDoFValue(dof: number): number;
    setMinLimit(dof: number, value: number): void;
    setMaxLimit(dof: number, value: number): void;
    minDoFLimit: Float32Array;
    maxDoFLimit: Float32Array;
    getClosureError(position: Float64Array, rotation: Float64Array): void;
};
/**
 * Minimum IK interface used by the mechanism adapter. The upstream declarations
 * use boxed numeric types and omit methods present in the pinned implementation.
 */
export type Solver = {
    maxIterations: number;
    translationConvergeThreshold: number;
    rotationConvergeThreshold: number;
    useSVD: boolean;
    solve(): void;
};
/**
 * Minimum IK interface used by the mechanism adapter. The upstream declarations
 * use boxed numeric types and omit methods present in the pinned implementation.
 */
export type KinematicsModule = {
    Link: new () => Link;
    Joint: new () => Joint;
    Solver: new (root: Link) => Solver;
    DOF: {
        X: number;
        Y: number;
        Z: number;
        EX: number;
        EY: number;
        EZ: number;
    };
};
