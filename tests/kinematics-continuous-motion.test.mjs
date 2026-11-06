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
