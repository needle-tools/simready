/** Joint axes, stops and angular limits in USD stage coordinates. */
/** @param {import('../kinematics.js').Mechanism & {root:import('three').Object3D}} mechanism
 * @param {{visible?:(path:string,body:string)=>boolean,selected?:(path:string,body:string)=>boolean}} [options] */
export function createJointHelpers(mechanism: import("../kinematics.js").Mechanism & {
    root: import("three").Object3D;
}, { visible, selected }?: {
    visible?: (path: string, body: string) => boolean;
    selected?: (path: string, body: string) => boolean;
}): {
    objects: import("three").LineSegments<BufferGeometry<import("three").NormalBufferAttributes, import("three").BufferGeometryEventMap>, import("three").LineBasicMaterial, import("three").Object3DEventMap>[];
    update: () => void;
    dispose(): void;
};
import { BufferGeometry } from 'three';
