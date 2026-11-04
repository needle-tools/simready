/** @param {unknown} value @returns {value is import('./index.js').PhysicsSnapshot} */
export function isSnapshot(value: unknown): value is import("./index.js").PhysicsSnapshot;
/** @param {unknown} value @returns {value is import('./index.js').SimreadyMetadata} */
export function isMetadata(value: unknown): value is import("./index.js").SimreadyMetadata;
export function isRecord(value: unknown): value is Record<string, unknown>;
export function isArray(value: unknown): value is unknown[];
export function isIssue(value: unknown): value is import("./index.js").PhysicsIssue;
export function isNumberBuffer(value: unknown): value is number[] | Float32Array | Int32Array | Uint16Array | Uint32Array;
export function isBinding(value: unknown): value is import("./index.js").SimreadyBinding;
export function isWireSnapshot(value: unknown): value is import("./index.js").WireSnapshot;
