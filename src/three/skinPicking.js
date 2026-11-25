// @ts-check

/** @import {Bone, BufferAttribute, InterleavedBufferAttribute, Intersection, Object3D, SkinnedMesh} from 'three' */

/** @type {WeakMap<Object3D, SkinnedMesh[]>} */
const skinsByStage = new WeakMap();

/** @param {Object3D} object @returns {object is SkinnedMesh} */
function isSkinnedMesh(object) {
    return 'isSkinnedMesh' in object && object.isSkinnedMesh === true;
}

/** @param {Object3D} object @param {Object3D} ancestor */
function isUnder(object, ancestor) {
    for (let node = /** @type {Object3D|null} */ (object); node; node = node.parent) {
        if (node === ancestor) return true;
    }
    return false;
}

/** A glTF skin can sit beside the stage while its bones are bound inside it.
 * @param {Object3D} stage @param {Object3D} scene @param {Object3D[]} boundObjects
 */
export function trackSkinnedSurfaces(stage, scene, boundObjects) {
    const bindings = new Set(boundObjects);
    /** @param {Bone} bone */
    function movesWithBody(bone) {
        for (let node = /** @type {Object3D|null} */ (bone); node; node = node.parent) {
            if (bindings.has(node)) return true;
            if (node === scene) break;
        }
        return false;
    }
    /** @type {SkinnedMesh[]} */
    const skins = [];
    scene.traverse(object => {
        if (!isSkinnedMesh(object) || !object.skeleton.bones.some(movesWithBody)) return;
        // A bind-pose sphere cannot cull an articulated skin.
        object.frustumCulled = false;
        skins.push(object);
    });
    if (skins.length) skinsByStage.set(stage, skins);
}

/** @param {Object3D} stage */
export function updatePickRoots(stage) {
    stage.updateWorldMatrix(true, true);
    const roots = [stage];
    for (const skin of skinsByStage.get(stage) ?? []) {
        skin.updateWorldMatrix(true, false);
        // SkinnedMesh also updates the inverse of its attached bind matrix here.
        skin.updateMatrixWorld(true);
        if (!isUnder(skin, stage)) roots.push(skin);
    }
    return roots;
}

/** @param {Object3D} stage */
export function invalidateSkinnedBounds(stage) {
    for (const skin of skinsByStage.get(stage) ?? []) {
        // Raycasting recomputes the sphere lazily. Rendering skips the stale bounds.
        const bounds = /** @type {{boundingSphere: import('three').Sphere|null, boundingBox: import('three').Box3|null}} */ (skin);
        bounds.boundingSphere = null;
        bounds.boundingBox = null;
    }
}

/** @param {BufferAttribute|InterleavedBufferAttribute} ids
 * @param {BufferAttribute|InterleavedBufferAttribute} weights @param {number} vertex
 */
function rigidInfluence(ids, weights, vertex) {
    const values = [weights.getX(vertex), weights.getY(vertex), weights.getZ(vertex), weights.getW(vertex)];
    const slot = values.indexOf(1);
    if (slot === -1 || values.some((weight, i) => i !== slot && weight !== 0)) return -1;
    return [ids.getX(vertex), ids.getY(vertex), ids.getZ(vertex), ids.getW(vertex)][slot];
}

/** Resolve only triangles that belong wholly to one joint.
 * @param {Intersection} hit
 */
export function rigidSkinHitJoint({object, face}) {
    if (!face || !isSkinnedMesh(object)) return null;
    const {skinIndex, skinWeight} = object.geometry.attributes;
    if (!skinIndex || !skinWeight) return null;
    const joint = rigidInfluence(skinIndex, skinWeight, face.a);
    if (joint < 0 || rigidInfluence(skinIndex, skinWeight, face.b) !== joint
        || rigidInfluence(skinIndex, skinWeight, face.c) !== joint) return null;
    return object.skeleton.bones[joint] ?? null;
}
