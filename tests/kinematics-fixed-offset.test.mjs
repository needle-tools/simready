import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion, Vector3} from 'three';
import {createMechanism} from '../src/kinematics.js';

for (const reversed of [false, true]) test(`an inconsistent fixed attachment preserves its rest offset without blocking valid hinges (reversed: ${reversed})`, async () => {
    const snapshot = {
        metersPerUnit: 1,
        bodies: [
            {path: '/Base', position: [0, 0, 0], rotation: [0, 0, 0, 1], kinematicBody: true},
            {path: '/Arm', position: [0, 1, 0], rotation: [0, 0, 0, 1]},
            {path: '/Lens', position: [.000012, .999985, -.0006], rotation: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), .2).toArray()},
        ],
        joints: [
            {path: '/Hinge', type: 'revolute', axis: 'Z', body0: '/Base', body1: '/Arm', position0: [0, 1, 0], limit: {enabled: true, lower: 0, upper: 95}},
            {path: '/Weld', type: 'fixed', body0: reversed ? '/Lens' : '/Arm', body1: reversed ? '/Arm' : '/Lens'},
        ],
    };
    const original = structuredClone(snapshot);
    const mechanism = await createMechanism({snapshot});
    try {
        assert.equal(mechanism.unsupported.length, 1);
        assert.equal(mechanism.unsupported[0].path, '/Weld');
        const lens = mechanism.bodies.get('/Lens').body;
        const restOffset = new Vector3(...snapshot.bodies[2].position).sub(new Vector3(...snapshot.bodies[1].position));
        assert.ok(new Vector3().copy(lens.translation()).distanceTo(new Vector3(...snapshot.bodies[2].position)) < 1e-6);
        mechanism.play();
        assert.equal(mechanism.beginDrag('/Arm', new Vector3(1, 1, 0)), true);
        mechanism.moveDrag(new Vector3(0, 2, 0));
        mechanism.endDrag();
        assert.ok(Math.abs(mechanism.getJointValue('/Hinge') - 90) < 1e-3);
        const expected = restOffset.applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)).add(new Vector3(0, 1, 0));
        assert.ok(new Vector3().copy(lens.translation()).distanceTo(expected) < 1e-6);
        const expectedRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2).multiply(new Quaternion(...snapshot.bodies[2].rotation));
        assert.ok(new Quaternion().copy(lens.rotation()).normalize().angleTo(expectedRotation) < 1e-6);
        assert.equal(mechanism.setJointValue('/Hinge', 180), true);
        assert.ok(Math.abs(mechanism.getJointValue('/Hinge') - 95) < 1e-3);
        mechanism.reset();
        assert.ok(new Vector3().copy(lens.translation()).distanceTo(new Vector3(...snapshot.bodies[2].position)) < 1e-6);
        assert.deepEqual(snapshot, original);
    } finally {mechanism.dispose();}
});

test('inconsistent movable joint frames still reject manipulation', async () => {
    const mechanism = await createMechanism({snapshot: {metersPerUnit: 1,
        bodies: [{path: '/Arm', position: [0, .01, 0], rotation: [0, 0, 0, 1]}],
        joints: [{path: '/Hinge', type: 'revolute', axis: 'Z', body1: '/Arm'}],
    }});
    try {
        assert.match(mechanism.unsupported[0].reason, /do not agree/);
        assert.equal(mechanism.setJointValue('/Hinge', 45), false);
    } finally {mechanism.dispose();}
});
