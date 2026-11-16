// @ts-check

/** @param {unknown} value @returns {value is ArrayBufferView & ArrayLike<number|bigint>} */
const numericView = value => ArrayBuffer.isView(value) && 'length' in value && typeof value.length === 'number';

/** Clone the JSON wire representation.
 * @param {unknown} value
 * @returns {unknown}
 */
export function copyJson(value) {
    /** @param {string} _key @param {unknown} item @returns {unknown} */
    const replace = (_key, item) => {
        if (numericView(item)) return Array.from(item);
        if (item instanceof DataView) return [];
        return item;
    };
    const text = JSON.stringify(value, replace);
    /** @type {unknown} */
    const result = JSON.parse(text);
    return result;
}
