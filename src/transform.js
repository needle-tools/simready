import {Quaternion, Vector3} from 'three';

/** Convert an independent asset into a host world's coordinates and units. */
/** @param {import('./index.js').PhysicsSnapshot} source
 * @param {{metersPerUnit?: number, kilogramsPerUnit?: number, position?: import('./index.js').PhysicsVector, rotation?: import('./index.js').PhysicsRotation}} [options]
 */
export function transformSnapshot(source, {metersPerUnit = 1, kilogramsPerUnit = 1, position = [0, 0, 0], rotation = [0, 0, 0, 1]} = {}) {
    if (!Number.isFinite(metersPerUnit) || !Number.isFinite(kilogramsPerUnit) || !(metersPerUnit > 0) || !(kilogramsPerUnit > 0) || position.length !== 3 || rotation.length !== 4 || ![...position, ...rotation].every(Number.isFinite) || !rotation.some(Boolean)) throw new RangeError('Invalid simulation world placement or units.');
    const snapshot = structuredClone(source);
    const length = ((source.metersPerUnit ?? 0) > 0 ? source.metersPerUnit ?? .01 : .01) / metersPerUnit;
    const mass = ((source.kilogramsPerUnit ?? 0) > 0 ? source.kilogramsPerUnit ?? 1 : 1) / kilogramsPerUnit;
    const basis = new Quaternion(...rotation).normalize();
    const up = source.upAxis === 'Z' ? new Vector3(0, 0, 1) : source.upAxis === 'X' ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    basis.multiply(new Quaternion().setFromUnitVectors(up, new Vector3(0, 1, 0)));
    const translate = new Vector3(...position);
    /** @param {import('./index.js').PhysicsVector} value @returns {import('./index.js').PhysicsVector} */
    const local = value => [value[0] * length, value[1] * length, value[2] * length];
    /** @param {import('./index.js').PhysicsVector} value */
    const worldPoint = value => new Vector3(...value).multiplyScalar(length).applyQuaternion(basis).add(translate).toArray();
    /** @param {import('./index.js').PhysicsRotation} value @returns {import('./index.js').PhysicsRotation} */
    const worldRotation = value => { const q = basis.clone().multiply(new Quaternion(...value)).normalize(); return [q.x,q.y,q.z,q.w]; };
    /** @param {import('./index.js').PhysicsMass} item */
    const properties = item => {
        if ((item.mass ?? 0) > 0) item.mass = (item.mass ?? 0) * mass;
        // USD density is mass / stage-length cubed, not kg / metre cubed.
        if ((item.density ?? 0) > 0) item.density = (item.density ?? 0) * mass / length ** 3;
        if (item.centerOfMass) item.centerOfMass = local(item.centerOfMass);
        if (item.diagonalInertia) item.diagonalInertia = [item.diagonalInertia[0] * mass * length ** 2, item.diagonalInertia[1] * mass * length ** 2, item.diagonalInertia[2] * mass * length ** 2];
    };
    for (const body of snapshot.bodies) {
        body.position = worldPoint(body.position); body.rotation = worldRotation(body.rotation);
        if (body.linearVelocity) body.linearVelocity = new Vector3(...body.linearVelocity).multiplyScalar(length).applyQuaternion(basis).toArray();
        if (body.angularVelocity) body.angularVelocity = new Vector3(...body.angularVelocity).applyQuaternion(basis).toArray();
        properties(body);
    }
    for (const shape of snapshot.shapes) {
        shape.position = shape.body ? local(shape.position || [0, 0, 0]) : worldPoint(shape.position || [0, 0, 0]);
        if (!shape.body) shape.rotation = worldRotation(shape.rotation || [0, 0, 0, 1]);
        if (shape.halfExtents) shape.halfExtents = local(shape.halfExtents);
        if (shape.radius !== undefined && Number.isFinite(shape.radius)) shape.radius *= length;
        if (shape.halfHeight !== undefined && Number.isFinite(shape.halfHeight)) shape.halfHeight *= length;
        if (shape.points) shape.points = Array.from(shape.points,n => n * length);
        properties(shape);
    }
    for (const joint of snapshot.joints) {
        for (const end of /** @type {const} */ ([0, 1])) {
            joint[end === 0 ? 'position0' : 'position1'] = joint[end === 0 ? 'body0' : 'body1'] ? local(joint[end === 0 ? 'position0' : 'position1'] || [0, 0, 0]) : worldPoint(joint[end === 0 ? 'position0' : 'position1'] || [0, 0, 0]);
            if (!joint[end === 0 ? 'body0' : 'body1']) joint[end === 0 ? 'rotation0' : 'rotation1'] = worldRotation(joint[end === 0 ? 'rotation0' : 'rotation1'] || [0, 0, 0, 1]);
        }
        const angular = joint.type === 'revolute' || joint.type === 'spherical';
        if (!angular && joint.limit) for (const key of /** @type {const} */ (['lower', 'upper'])) {const value=joint.limit[key];if(value!==null&&Number.isFinite(value))joint.limit[key]=value*length;}
        for (const key of /** @type {const} */ (['minDistance', 'maxDistance'])) if (joint[key] !== undefined && Number.isFinite(joint[key])) joint[key] *= length;
        if (joint.mimic) {
            const reference = source.joints.find(item => item.path === joint.mimic?.joint);
            const referenceAngular = reference?.type === 'revolute' || reference?.type === 'spherical';
            joint.mimic.multiplier *= (angular ? 1 : length) / (referenceAngular ? 1 : length);
            if (!angular) joint.mimic.offset *= length;
        }
        if (joint.drive) {
            const d = joint.drive, force = mass * length ** (angular ? 2 : 1);
            if (!angular) { d.targetPosition *= length; d.targetVelocity *= length; }
            if (!d.acceleration) { d.stiffness *= force / (angular ? 1 : length); d.damping *= force / (angular ? 1 : length); }
            if (d.forceLimit != null && Number.isFinite(d.forceLimit)) d.forceLimit *= force;
        }
        if (joint.breakForce != null && Number.isFinite(joint.breakForce)) joint.breakForce *= mass * length;
        if (joint.breakTorque != null && Number.isFinite(joint.breakTorque)) joint.breakTorque *= mass * length ** 2;
    }
    for (const material of snapshot.materials) properties(material);
    for (const scene of snapshot.scenes) {
        if (scene.gravityDirection) scene.gravityDirection = new Vector3(...scene.gravityDirection).applyQuaternion(basis).toArray();
        if (scene.gravityMagnitude !== undefined && Number.isFinite(scene.gravityMagnitude)) scene.gravityMagnitude *= length;
    }
    snapshot.metersPerUnit = metersPerUnit; snapshot.kilogramsPerUnit = kilogramsPerUnit; snapshot.upAxis = 'Y';
    return snapshot;
}
