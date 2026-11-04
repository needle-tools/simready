/**
 * Move a computed inertia tensor to an authored center of mass, following
 * UsdPhysicsMassProperties::TranslateInertia. Inputs share one body-local,
 * scale-free frame; mass and diagonalInertia must already use the same units.
 * Returns Rapier-compatible diagonal moments and their local principal frame.
 */
/** @param {import('./index.js').PhysicsVector | Float32Array | import('three').Vector3Like} diagonalInertia
 * @param {import('./index.js').PhysicsRotation | Float32Array | import('three').QuaternionLike} principalAxes
 * @param {number} mass
 * @param {import('./index.js').PhysicsVector | Float32Array | import('three').Vector3Like} oldCenterOfMass
 * @param {import('./index.js').PhysicsVector | Float32Array | import('three').Vector3Like} newCenterOfMass
 */
export function shiftInertiaToCenterOfMass(diagonalInertia: import("./index.js").PhysicsVector | Float32Array | import("three").Vector3Like, principalAxes: import("./index.js").PhysicsRotation | Float32Array | import("three").QuaternionLike, mass: number, oldCenterOfMass: import("./index.js").PhysicsVector | Float32Array | import("three").Vector3Like, newCenterOfMass: import("./index.js").PhysicsVector | Float32Array | import("three").Vector3Like): {
    diagonalInertia: Vector3;
    principalAxes: Quaternion;
};
import { Vector3 } from 'three';
import { Quaternion } from 'three';
