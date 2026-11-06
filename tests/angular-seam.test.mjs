import {test} from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {Quaternion, Vector3} from 'three';
import {createSimulation, createSimulationWorld} from '../src/rapier.js';
import {offsetRotorSnapshot} from './helpers/continuous-motion.mjs';
await R.init();

for (const shared of [false, true]) for (const sign of [1, -1])
    test(`angular limits cross the quaternion seam without losing either hard stop (${sign}, ${shared ? 'shared' : 'standalone'})`, async () => {
        const snapshot = offsetRotorSnapshot(sign);
        snapshot.bodies[0].rotation = [0, 0, 1, 0];
        const lower = sign > 0 ? 170 : -190, upper = sign > 0 ? 190 : -170;
        snapshot.joints[0].limit = {enabled: true, lower, upper};
        snapshot.joints[0].drive.targetPosition = sign * 185;
        const world = shared ? createSimulationWorld({rapier: R, gravity: [0, 0, 0]}) : null;
        const sim = world ? await world.addAsset({snapshot}) : await createSimulation({rapier: R, snapshot});
        const settle = expected => {
            for (let i = 0; i < 1200; i++) {
                if (world) world.step(1 / 120); else sim.step(1 / 120);
                const value = sim.getJointValue('/Motor');
                assert.ok(value >= lower - .1 && value <= upper + .1, `hard stop exceeded: ${value}`);
                assert.equal(sim.joints.get('/Motor').limitsEnabled(), true);
            }
            const value = sim.getJointValue('/Motor');
            assert.ok(Math.abs(value - expected) < .1, `${value} instead of ${expected}`);
        };
        try {
            assert.ok(Math.abs(sim.getJointValue('/Motor') - sign * 180) < 1e-5);
            settle(sign * 185);
            sim.setJointTarget('/Motor', {position: sign * 175});
            settle(sign * 175);
            // Commands beyond each authored endpoint must encounter real limits.
            sim.setJointTarget('/Motor', {position: sign * 200});
            settle(sign * 190);
            sim.setJointTarget('/Motor', {position: sign * 160});
            settle(sign * 170);
            sim.reset();
            assert.ok(Math.abs(sim.getJointValue('/Motor') - sign * 180) < 1e-5);
            sim.play();
            settle(sign * 185);
        } finally {
            if (world) world.dispose(); else sim.dispose();
        }
    });

for (const axis of ['X', 'Y']) test(`seam recentering preserves rotated ${axis} joint frames`, async () => {
    const snapshot = offsetRotorSnapshot(1), joint = snapshot.joints[0];
    const frame0 = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), .4);
    const frame1 = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -.3);
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(axis === 'X' ? 1 : 0, axis === 'Y' ? 1 : 0, 0), Math.PI);
    snapshot.bodies[0].rotation = frame0.clone().multiply(rotation).multiply(frame1.clone().invert()).toArray();
    joint.axis = axis;
    joint.rotation0 = frame0.toArray();
    joint.rotation1 = frame1.toArray();
    joint.limit = {enabled: true, lower: 170, upper: 190};
    joint.drive.targetPosition = 185;
    const sim = await createSimulation({rapier: R, snapshot});
    try {
        assert.ok(Math.abs(sim.getJointValue('/Motor') - 180) < 1e-4);
        for (const target of [185, 175]) {
            sim.setJointTarget('/Motor', {position: target});
            for (let i = 0; i < 1200; i++) sim.step(1 / 120);
            assert.ok(Math.abs(sim.getJointValue('/Motor') - target) < .1);
            const body = new Quaternion().copy(sim.bodies.get('/Rotor').body.rotation());
            const relative = frame0.clone().invert().multiply(body).multiply(frame1);
            const expected = new Quaternion().setFromAxisAngle(new Vector3(axis === 'X' ? 1 : 0, axis === 'Y' ? 1 : 0, 0), target * Math.PI / 180);
            assert.ok(relative.angleTo(expected) < .002, 'hinge axis or authored frame changed');
        }
    } finally { sim.dispose(); }
});
