/** A glTF skin can sit beside the stage while its bones are bound inside it.
 * @param {Object3D} stage @param {Object3D} scene @param {Object3D[]} boundObjects
 */
export function trackSkinnedSurfaces(stage: Object3D, scene: Object3D, boundObjects: Object3D[]): void;
/** @param {Object3D} stage */
export function updatePickRoots(stage: Object3D): Object3D<import("three").Object3DEventMap>[];
/** @param {Object3D} stage */
export function invalidateSkinnedBounds(stage: Object3D): void;
/** Resolve only triangles that belong wholly to one joint.
 * @param {Intersection} hit
 */
export function rigidSkinHitJoint({ object, face }: Intersection): Bone<import("three").Object3DEventMap> | null;
import type { Object3D } from 'three';
import type { Intersection } from 'three';
import type { Bone } from 'three';
