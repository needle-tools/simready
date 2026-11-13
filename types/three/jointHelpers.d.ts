/** @typedef {Pick<import('../kinematics.js').JointRecord,'data'|'sign'|'dof'|'parent'|'child'|'angular'|'lower'|'upper'>} HelperJoint */
/** Joint axes, stops and angular limits in stage coordinates, from live poses. */
/** @param {{root:import('three').Object3D,metersPerUnit:number,joints:ReadonlyMap<string,HelperJoint>,bodies:import('../kinematics.js').MechanismBodies,getJointValue(path:string):number|null,isPlaying():boolean}} mechanism
 * @param {{visible?:(path:string,body:string)=>boolean,selected?:(path:string,body:string)=>boolean}} [options]
 * @returns {{objects:import('three').LineSegments<BufferGeometry,import('three').LineBasicMaterial>[],update():void,dispose():void}} */
export function createJointHelpers(mechanism: {
    root: import("three").Object3D;
    metersPerUnit: number;
    joints: ReadonlyMap<string, HelperJoint>;
    bodies: import("../kinematics.js").MechanismBodies;
    getJointValue(path: string): number | null;
    isPlaying(): boolean;
}, { visible, selected }?: {
    visible?: (path: string, body: string) => boolean;
    selected?: (path: string, body: string) => boolean;
}): {
    objects: import("three").LineSegments<BufferGeometry, import("three").LineBasicMaterial>[];
    update(): void;
    dispose(): void;
};
export type HelperJoint = Pick<import("../kinematics.js").JointRecord, "data" | "sign" | "dof" | "parent" | "child" | "angular" | "lower" | "upper">;
import { BufferGeometry } from 'three';
