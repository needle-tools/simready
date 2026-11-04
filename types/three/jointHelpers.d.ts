/** Joint axes, stops and angular limits in USD stage coordinates. */
/** @param {import('../kinematics.js').Mechanism & {root:import('three').Object3D}} mechanism
 * @param {{visible?:(path:string,body:string)=>boolean,selected?:(path:string,body:string)=>boolean}} [options]
 * @returns {{objects:import('three').LineSegments<BufferGeometry,import('three').LineBasicMaterial>[],update():void,dispose():void}} */
export function createJointHelpers(mechanism: import("../kinematics.js").Mechanism & {
    root: import("three").Object3D;
}, { visible, selected }?: {
    visible?: (path: string, body: string) => boolean;
    selected?: (path: string, body: string) => boolean;
}): {
    objects: import("three").LineSegments<BufferGeometry, import("three").LineBasicMaterial>[];
    update(): void;
    dispose(): void;
};
import { BufferGeometry } from 'three';
