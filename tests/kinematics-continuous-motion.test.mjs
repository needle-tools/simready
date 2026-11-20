import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMechanism } from '../src/kinematics.js';
import {
    screwSnapshot,
    offsetRotorSnapshot,
} from './helpers/continuous-motion.mjs';

test('wide kinematic limits preserve the authored rest turn and full screw travel', async () => {
    const mechanism = await createMechanism({ snapshot: screwSnapshot() });
    try {
        assert.ok(
            Math.abs(mechanism.getJointValue('/Motor')) < 1e-6,
            `authored rest: ${mechanism.getJointValue('/Motor')}`,
        );
        for (const value of [1200, 4800, 9600, 0]) {
            assert.equal(mechanism.setJointValue('/Motor', value), true);
            assert.ok(
                Math.abs(mechanism.getJointValue('/Motor') - value) < 1e-3,
            );
            assert.ok(
                Math.abs(
                    mechanism.getJointValue('/ScrewSlide') -
                        (value * 0.003) / 360,
                ) < 1e-6,
            );
            assert.ok(
                Math.abs(
                    mechanism.bodies.get('/Slide').body.translation().x -
                        (value * 0.003) / 360,
                ) < 1e-6,
            );
        }
        assert.equal(mechanism.setJointValue('/Motor', 9601), true);
        assert.ok(Math.abs(mechanism.getJointValue('/Motor') - 9600) < 1e-3);
        assert.equal(mechanism.setJointValue('/Motor', -1), true);
        assert.ok(Math.abs(mechanism.getJointValue('/Motor')) < 1e-3);
        assert.equal(mechanism.setJointValue('/Motor', 4800), true);
        mechanism.reset();
        assert.ok(Math.abs(mechanism.getJointValue('/Motor')) < 1e-3);
        assert.ok(Math.abs(mechanism.getJointValue('/ScrewSlide')) < 1e-6);
    } finally {
        mechanism.dispose();
    }
});

for (const sign of [1, -1])
    test(`kinematics chooses the nearest valid authored rest turn (${sign})`, async () => {
        const data = offsetRotorSnapshot(sign);
        data.joints[0].drive.enabled = false;
        const authored = structuredClone(data);
        const mechanism = await createMechanism({ snapshot: data });
        try {
            assert.deepEqual(mechanism.unsupported, []);
            assert.ok(
                Math.abs(mechanism.getJointValue('/Motor') - sign * 720) < 1e-3,
            );
            for (const value of [sign * 900, sign * 1080, sign * 720]) {
                assert.equal(mechanism.setJointValue('/Motor', value), true);
                assert.ok(
                    Math.abs(mechanism.getJointValue('/Motor') - value) < 1e-3,
                );
            }
            assert.equal(mechanism.setJointValue('/Motor', sign * 719), true);
            assert.ok(
                Math.abs(mechanism.getJointValue('/Motor') - sign * 720) < 1e-3,
            );
            assert.equal(mechanism.setJointValue('/Motor', sign * 1081), true);
            assert.ok(
                Math.abs(mechanism.getJointValue('/Motor') - sign * 1080) <
                    1e-3,
            );
            mechanism.setJointValue('/Motor', sign * 900);
            mechanism.reset();
            assert.ok(
                Math.abs(mechanism.getJointValue('/Motor') - sign * 720) < 1e-3,
            );
            assert.deepEqual(
                data,
                authored,
                'posing and reset keep the authored snapshot detached',
            );
        } finally {
            mechanism.dispose();
        }
    });

test('a revolute rest reference picks the equivalent turn inside limits, including reversed endpoints', async () => {
    for (const reversed of [false,true]) {
        const data = offsetRotorSnapshot(1), joint = data.joints[0];
        if (reversed) { joint.body0=joint.body1; joint.body1=''; }
        for (const [reference,expected] of [[740,720],[1060,1080],[2000,1080]]) {
            joint.referenceAngle=reference;
            const mechanism=await createMechanism({snapshot:data});
            try { assert.ok(Math.abs(mechanism.getJointValue('/Motor')-expected)<.001); }
            finally { mechanism.dispose(); }
        }
    }
});

test('point dragging a rotor past half a turn respects only authored stops', async () => {
    for (const bounded of [false, true]) {
        const snapshot = offsetRotorSnapshot(1);
        snapshot.joints[0].limit = {enabled: bounded, lower: -180, upper: 180};
        const mechanism = await createMechanism({snapshot, dragMode: 'point'});
        try {
            mechanism.play();
            assert.ok(mechanism.beginDrag('/Rotor', {x: 1, y: 0, z: 0}));
            for (let degrees = 5; degrees <= 450; degrees += 5) {
                const angle = degrees * Math.PI / 180;
                mechanism.moveDrag({x: Math.cos(angle), y: Math.sin(angle), z: 0});
                const value = mechanism.getJointValue('/Motor');
                if (!bounded || degrees <= 180) assert.ok(Math.abs(value - degrees) < .1, `${value} at ${degrees}°`);
                else assert.ok(Math.abs(value) <= 180.001, `passed an authored stop: ${value}`);
            }
        } finally { mechanism.dispose(); }
    }
});

test('joint overlays mark the current angle and only finite stops', async () => {
    const {Group} = await import('three');
    const {createJointHelpers} = await import('../src/three.js');
    for (const [lower, upper, markers] of [[null, null, 1], [270, null, 2], [null, -270, 2], [-180, 180, 3]]) {
        const snapshot = offsetRotorSnapshot(1);
        snapshot.joints[0].limit = {enabled: true, lower, upper};
        const mechanism = await createMechanism({snapshot});
        mechanism.play();
        const helpers = createJointHelpers({...mechanism, root: new Group()});
        try {
            assert.equal(helpers.objects[0].children[0].geometry.attributes.position.count, markers);
        } finally {
            helpers.dispose();
            mechanism.dispose();
        }
    }
});
