// @ts-check

/** @param {unknown} value @returns {value is ArrayBufferView & ArrayLike<number|bigint>} */
const numericView = value => ArrayBuffer.isView(value) && 'length' in value && typeof value.length === 'number';

/** Clone the JSON wire representation; semantic metadata can retain special numbers.
 * @param {unknown} value
 * @param {boolean} [tagNumbers]
 * @returns {unknown}
 */
export function copyJson(value, tagNumbers = false) {
    /** @param {string} _key @param {unknown} item @returns {unknown} */
    const replace = (_key, item) => {
        if (tagNumbers && typeof item === 'number' && !Number.isFinite(item)) return {$usdNumber: String(item)};
        if (tagNumbers && typeof item === 'bigint') return {$usdInteger: String(item)};
        if (numericView(item)) return Array.from(item);
        if (item instanceof DataView) return [];
        return item;
    };
    const text = JSON.stringify(value, replace);
    /** @type {unknown} */
    const result = JSON.parse(text);
    return result;
}
