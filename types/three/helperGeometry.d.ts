/** @overload
 * @param {string} kind @param {string} path @param {number[]} positions
 * @param {true} points @param {import('three').ColorRepresentation} [color]
 * @returns {Points<BufferGeometry,PointsMaterial>}
 */
export function helperGeometry(kind: string, path: string, positions: number[], points: true, color?: import("three").ColorRepresentation | undefined): Points<BufferGeometry, PointsMaterial>;
/** @overload
 * @param {string} kind @param {string} path @param {number[]} positions
 * @param {false} [points] @param {import('three').ColorRepresentation} [color]
 * @returns {LineSegments<BufferGeometry,LineBasicMaterial>}
 */
export function helperGeometry(kind: string, path: string, positions: number[], points?: false | undefined, color?: import("three").ColorRepresentation | undefined): LineSegments<BufferGeometry, LineBasicMaterial>;
/** @param {import('three').Object3D} object */
export function disposeHelper(object: import("three").Object3D): void;
import { Points } from 'three';
import { BufferGeometry } from 'three';
import { PointsMaterial } from 'three';
import { LineSegments } from 'three';
import { LineBasicMaterial } from 'three';
