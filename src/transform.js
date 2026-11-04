import {Quaternion, Vector3} from 'three';

/** Convert an independent asset into a host world's coordinates and units. */
export function transformSnapshot(source, {metersPerUnit = 1, kilogramsPerUnit = 1, position = [0, 0, 0], rotation = [0, 0, 0, 1]} = {}) {
    if (!Number.isFinite(metersPerUnit) || !Number.isFinite(kilogramsPerUnit) || !(metersPerUnit > 0) || !(kilogramsPerUnit > 0) || position.length !== 3 || rotation.length !== 4 || ![...position, ...rotation].every(Number.isFinite) || !rotation.some(Boolean)) throw new RangeError('Invalid simulation world placement or units.');
    const snapshot = structuredClone(source);
    const length = (source.metersPerUnit > 0 ? source.metersPerUnit : .01) / metersPerUnit;
    const mass = (source.kilogramsPerUnit > 0 ? source.kilogramsPerUnit : 1) / kilogramsPerUnit;
    const basis = new Quaternion(...rotation).normalize();
    const up = source.upAxis === 'Z' ? new Vector3(0, 0, 1) : source.upAxis === 'X' ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    basis.multiply(new Quaternion().setFromUnitVectors(up, new Vector3(0, 1, 0)));
    const translate = new Vector3(...position);
    const local = value => Array.from(value, n => n * length);
    const worldPoint = value => new Vector3(...value).multiplyScalar(length).applyQuaternion(basis).add(translate).toArray();
    const worldRotation = value => basis.clone().multiply(new Quaternion(...value)).toArray();
    const properties = item => {
        if (item.mass > 0) item.mass *= mass;
        // USD density is mass / stage-length cubed, not kg / metre cubed.
        if (item.density > 0) item.density *= mass / length ** 3;
        if (item.centerOfMass) item.centerOfMass = local(item.centerOfMass);
        if (item.diagonalInertia) item.diagonalInertia = item.diagonalInertia.map(n => n * mass * length ** 2);
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
        if (Number.isFinite(shape.radius)) shape.radius *= length;
        if (Number.isFinite(shape.halfHeight)) shape.halfHeight *= length;
        if (shape.points) shape.points = Array.from(shape.points, n => n * length);
        properties(shape);
    }
    for (const joint of snapshot.joints) {
        for (const end of [0, 1]) {
            joint['position' + end] = joint['body' + end] ? local(joint['position' + end] || [0, 0, 0]) : worldPoint(joint['position' + end] || [0, 0, 0]);
            if (!joint['body' + end]) joint['rotation' + end] = worldRotation(joint['rotation' + end] || [0, 0, 0, 1]);
        }
        const angular = joint.type === 'revolute';
        if (!angular && joint.limit) for (const key of ['lower', 'upper']) if (Number.isFinite(joint.limit[key])) joint.limit[key] *= length;
        for (const key of ['minDistance', 'maxDistance']) if (Number.isFinite(joint[key])) joint[key] *= length;
        if (joint.mimic && !angular) joint.mimic.offset *= length;
        if (joint.drive) {
            const d = joint.drive, force = mass * length ** (angular ? 2 : 1);
            if (!angular) { d.targetPosition *= length; d.targetVelocity *= length; }
            if (!d.acceleration) { d.stiffness *= force / (angular ? 1 : length); d.damping *= force / (angular ? 1 : length); }
            if (Number.isFinite(d.forceLimit)) d.forceLimit *= force;
        }
        if (Number.isFinite(joint.breakForce)) joint.breakForce *= mass * length;
        if (Number.isFinite(joint.breakTorque)) joint.breakTorque *= mass * length ** 2;
    }
    for (const material of snapshot.materials) properties(material);
    for (const scene of snapshot.scenes) {
        if (scene.gravityDirection) scene.gravityDirection = new Vector3(...scene.gravityDirection).applyQuaternion(basis).toArray();
        if (Number.isFinite(scene.gravityMagnitude)) scene.gravityMagnitude *= length;
    }
    snapshot.metersPerUnit = metersPerUnit; snapshot.kilogramsPerUnit = kilogramsPerUnit; snapshot.upAxis = 'Y';
    return snapshot;
}
