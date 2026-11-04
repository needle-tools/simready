/** Clone the JSON wire representation; semantic metadata can retain special numbers.
 * @param {unknown} value
 * @param {boolean} [tagNumbers]
 * @returns {unknown}
 */
export function copyJson(value: unknown, tagNumbers?: boolean): unknown;
