/** Compact a validated snapshot projected for export. @param {import('../index.js').WireSnapshot} snapshot */
export function omitRuntimeDefaults(snapshot: import("../index.js").WireSnapshot): void;
/** @param {import('../index.js').WireSnapshot} source @returns {import('../index.js').WireSnapshot} */
export function runtimeSnapshot(source: import("../index.js").WireSnapshot): import("../index.js").WireSnapshot;
/** @param {import('../index.js').WireSnapshot} source */
export function isRuntimeSnapshot(source: import("../index.js").WireSnapshot): boolean;
/** @param {unknown} value @returns {value is import('../index.js').SimreadySemanticLabels[]} */
export function isRuntimeSemantics(value: unknown): value is import("../index.js").SimreadySemanticLabels[];
/** @param {unknown} value @returns {value is import('../index.js').SimreadyRuntimeExtension} */
export function isRuntimeExtension(value: unknown): value is import("../index.js").SimreadyRuntimeExtension;
