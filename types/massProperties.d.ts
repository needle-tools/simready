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
/**
 * Mass, center of mass and principal inertia of every body in a snapshot, in the
 * snapshot's units and each body's local frame. Follows USD's precedence: an authored
 * body mass wins, otherwise the colliders' masses add up. A collider uses its authored
 * mass, else its volume times the collider's, the body's or its material's density,
 * else 1000 kg/m³. Authored centers of mass and inertia override derived ones. A body
 * with no colliders and no authored mass gets mass 1 and unit inertia.
 * @param {import('./index.js').PhysicsSnapshot} snapshot
 * @returns {Map<string,BodyMassProperties>}
 */
export function computeMassProperties(snapshot: import("./index.js").PhysicsSnapshot): Map<string, BodyMassProperties>;
export type BodyMassProperties = {
    mass: number;
    centerOfMass: import("./index.js").PhysicsVector;
    diagonalInertia: import("./index.js").PhysicsVector;
    principalAxes: import("./index.js").PhysicsRotation;
    source: "authored" | "colliders" | "default";
};
import { Vector3 } from 'three';
import { Quaternion } from 'three';
