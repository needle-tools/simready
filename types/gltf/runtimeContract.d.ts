/** @param {import('../index.js').WireSnapshot} source @returns {import('../index.js').WireSnapshot} */
export function runtimeSnapshot(source: import("../index.js").WireSnapshot): import("../index.js").WireSnapshot;
/** @param {import('../index.js').WireSnapshot} source */
export function isRuntimeSnapshot(source: import("../index.js").WireSnapshot): boolean;
/** @param {unknown} value @returns {value is import('../index.js').SimreadySemanticLabels[]} */
export function isRuntimeSemantics(value: unknown): value is import("../index.js").SimreadySemanticLabels[];
