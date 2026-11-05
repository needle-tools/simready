// @ts-check

/** @param {unknown} value @returns {value is Record<string, unknown>} */
export const isRecord = value => value !== null && typeof value === 'object' && !isArray(value);
/** @param {unknown} value @returns {value is unknown[]} */
export const isArray = value => Array.isArray(value);
/** @param {unknown} value @returns {value is string[]} */
const strings = value => isArray(value) && value.every(item => typeof item === 'string');
/** @param {unknown} value @param {number} size */
const vector = (value, size) => isArray(value) && value.length === size && value.every(item => typeof item === 'number');
/** @param {Record<string,unknown>} record @param {string[]} keys @param {(value:unknown)=>boolean} check */
const optional = (record, keys, check) => keys.every(key => record[key] === undefined || check(record[key]));
/** @param {unknown} value */
const number = value => typeof value === 'number';
/** @param {unknown} value */
const boolean = value => typeof value === 'boolean';
/** @param {unknown} value */
const text = value => typeof value === 'string';
/** @param {unknown} value */
const axis = value => value === 'X' || value === 'Y' || value === 'Z';
/** @param {unknown} value */
const v3 = value => vector(value, 3);
/** @param {unknown} value */
const v4 = value => vector(value, 4);
/** @param {Record<string,unknown>} value */
const mass = value => optional(value, ['mass','density'], item => item === null || number(item))
    && optional(value, ['centerOfMass','diagonalInertia'], v3) && optional(value, ['principalAxes'], v4);
/** @param {unknown} value */
const identity = value => isRecord(value) && typeof value.path === 'string' && value.path.length > 0;
/** @param {unknown} value @returns {value is import('./index.js').PhysicsIssue} */
export const isIssue = value => isRecord(value) && typeof value.path === 'string' && typeof value.reason === 'string' && optional(value, ['type'], text);
/** @param {unknown} value */
const body = value => isRecord(value) && identity(value) && v3(value.position) && v4(value.rotation) && mass(value)
    && optional(value, ['scale','linearVelocity','angularVelocity'], v3)
    && optional(value, ['rigidBodyEnabled','kinematicBody','startsAsleep'], boolean)
    && optional(value, ['filteredCollisions','simulationOwners'], strings);
/** Lazy buffers stay unopened during unsupported-feature preflight.
 * @param {Record<string,unknown>} value @param {string} key @param {(value:unknown)=>boolean} check
 */
function bufferField(value, key, check) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get) return true;
    /** @type {unknown} */
    const data = descriptor.value;
    return data === undefined || check(data);
}
/** @param {unknown} value @returns {value is number[] | Float32Array | Int32Array | Uint16Array | Uint32Array} */
export const isNumberBuffer = value => isArray(value) && value.every(number)
    || value instanceof Float32Array || value instanceof Int32Array || value instanceof Uint16Array || value instanceof Uint32Array;
/** @param {unknown} value */
const points = value => isArray(value) && value.every(number) || value instanceof Float32Array;
/** @param {unknown} value */
const indices = value => isArray(value) && value.every(number) || value instanceof Int32Array || value instanceof Uint16Array || value instanceof Uint32Array;
/** @param {unknown} value */
const shape = value => isRecord(value) && identity(value) && typeof value.type === 'string' && mass(value)
    && optional(value, ['body','approximation'], text) && optional(value, ['axis'], axis) && optional(value, ['position','scale','meshScale','halfExtents'], v3)
    && optional(value, ['rotation'], v4) && optional(value, ['collisionEnabled'], boolean)
    && optional(value, ['radius','halfHeight'], number) && optional(value, ['simulationOwners','materials','filteredCollisions','collisionGroups'], strings)
    && bufferField(value, 'points', points) && bufferField(value, 'indices', indices);
/** @param {unknown} value */
const joint = value => isRecord(value) && identity(value) && typeof value.type === 'string'
    && optional(value, ['body0','body1'], text) && optional(value, ['axis'], axis) && optional(value, ['position0','position1'], v3)
    && optional(value, ['rotation0','rotation1'], v4)
    && optional(value, ['jointEnabled','collisionEnabled','excludeFromArticulation','minEnabled','maxEnabled'], boolean)
    && optional(value, ['minDistance','maxDistance'], number)
    && optional(value, ['breakForce','breakTorque'], item => item === null || number(item))
    && optional(value, ['limit'], item => isRecord(item) && boolean(item.enabled) && (item.lower === null || number(item.lower)) && (item.upper === null || number(item.upper)))
    && optional(value, ['drive'], item => isRecord(item) && boolean(item.enabled) && optional(item, ['acceleration'], boolean)
        && ['targetPosition','targetVelocity','stiffness','damping'].every(key => number(item[key]))
        && optional(item, ['forceLimit'], force => force === null || number(force)))
    && optional(value, ['mimic'], item => isRecord(item) && typeof item.joint === 'string' && number(item.multiplier) && number(item.offset));
/** @param {unknown} value @returns {value is import('./index.js').PhysicsSnapshot} */
export function isSnapshot(value) {
    if (!isRecord(value) || !optional(value, ['metersPerUnit','kilogramsPerUnit'], number) || !optional(value, ['upAxis'], text)) return false;
    /** @type {Record<'bodies'|'shapes'|'joints'|'materials'|'groups'|'scenes', (value:unknown)=>boolean>} */
    const checks = {bodies:body,shapes:shape,joints:joint,
        materials: item => isRecord(item) && identity(item) && optional(item, ['density','staticFriction','dynamicFriction','restitution'], number),
        groups: item => isRecord(item) && identity(item) && optional(item, ['filteredGroups','mergedGroups'], strings) && optional(item, ['invertFilteredGroups'], boolean),
        scenes: item => isRecord(item) && identity(item) && optional(item, ['gravityDirection'], v3) && optional(item, ['gravityMagnitude'], number)};
    for (const key of /** @type {const} */ (['bodies','shapes','joints','materials','groups','scenes'])) {
        const items = value[key];
        if (!isArray(items) || !items.every(checks[key])) return false;
    }
    return optional(value, ['unsupported'], item => isArray(item) && item.every(isIssue))
        && optional(value, ['articulations'], item => isArray(item) && item.every(record => isRecord(record) && identity(record)
            && ['rootPrims','filteredCollisions','articulatedJoints','articulatedBodies'].every(key => strings(record[key]))));
}
/** @param {unknown} value @returns {value is import('./index.js').SimreadyMetadata} */
export function isMetadata(value) {
    if (!isRecord(value) || value.version !== 1 || typeof value.time !== 'number' || !isRecord(value.stage) || !isArray(value.prims)) return false;
    return value.prims.every(prim => isRecord(prim) && identity(prim) && typeof prim.type === 'string'
        && optional(prim, ['active'], item => item === false) && optional(prim, ['metadata'], isRecord)
        && optional(prim, ['attributes'], item => isArray(item) && item.every(attribute => isRecord(attribute)
            && typeof attribute.name === 'string' && attribute.name.length > 0 && typeof attribute.type === 'string' && attribute.type.length > 0 && Object.hasOwn(attribute,'value')
            && optional(attribute, ['metadata'], isRecord) && optional(attribute, ['connections'], strings)
            && optional(attribute, ['samples'], samples => isArray(samples) && samples.every(sample => isRecord(sample) && typeof sample.time === 'number' && Object.hasOwn(sample,'value')))))
        && optional(prim, ['relationships'], item => isArray(item) && item.every(relation => isRecord(relation) && typeof relation.name === 'string'
            && strings(relation.targets) && optional(relation, ['metadata'], isRecord)))
        && optional(prim, ['variants'], item => isArray(item) && item.every(variant => isRecord(variant)
            && typeof variant.name === 'string' && typeof variant.selection === 'string' && strings(variant.choices))));
}

/** @param {unknown} value @returns {value is import('./index.js').SimreadyBinding} */
export const isBinding = value => isRecord(value) && typeof value.node === 'number' && Number.isInteger(value.node) && value.node >= 0 && typeof value.path === 'string' && value.path.length > 0 && optional(value, ['body'], text);
/** @param {unknown} value @returns {value is import('./index.js').WireSnapshot} */
export const isWireSnapshot = value => isSnapshot(value) && value.shapes.every(shape => shape.points === undefined && shape.indices === undefined
    && (!('mesh' in shape) || typeof shape.mesh === 'number'));
