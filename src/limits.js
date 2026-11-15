// @ts-check
// PhysX uses PX_MAX_F32 for an unbreakable joint, including authored USD files.
// https://nvidia-omniverse.github.io/PhysX/physx/5.4.0/docs/Joints.html#breakage
/** @param {number|null|undefined} value @returns {value is number} */
export const isBoundedThreshold = value => typeof value === 'number' && Number.isFinite(value) && value < 3.4028234663852886e38;
