import { test } from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import { createSimulation, createSimulationWorld } from '../src/rapier.js';
import {
    screwSnapshot,
    offsetRotorSnapshot,
} from './helpers/continuous-motion.mjs';
await R.init();

for (const shared of [false, true])
    test(`multi-turn screw keeps accumulated angle, slide coupling, hard stops and reset (${shared ? 'shared' : 'standalone'})`, async () => {
        const world = shared
            ? createSimulationWorld({ rapier: R, gravity: [0, 0, 0] })
            : null;
        const sim = world
            ? await world.addAsset({ snapshot: screwSnapshot() })
            : await createSimulation({ rapier: R, snapshot: screwSnapshot() });
        const step = () => (world ? world.step(1 / 120) : sim.step(1 / 120));
        try {
            assert.ok(
                Math.abs(sim.getJointValue('/Motor')) < 1e-6,
                'closed rest coordinate is zero, not the limit midpoint',
            );
            for (let i = 0; i < 2400; i++) {
                step();
                if (i % 120 === 0) {
                    const angle = sim.getJointValue('/Motor');
                    if (i === 120)
                        assert.ok(
                            angle > 600 && angle < 800,
                            `one second must accumulate two turns, got ${angle}`,
                        );
                    assert.ok(
                        angle >= -0.5 && angle <= 9600.5,
                        `limit ${angle}`,
                    );
                    assert.ok(
                        Math.abs(
                            sim.getJointValue('/ScrewSlide') -
                                (angle * 0.003) / 360,
                        ) < 0.001,
                    );
                }
            }
            assert.ok(
                Math.abs(sim.getJointValue('/Motor') - 9600) < 0.5,
                `${sim.getJointValue('/Motor')}`,
            );
            sim.setJointTarget('/Motor', { velocity: -720 });
            for (let i = 0; i < 2400; i++) step();
            assert.ok(
                Math.abs(sim.getJointValue('/Motor')) < 0.5,
                `${sim.getJointValue('/Motor')}`,
            );
            sim.reset();
            assert.ok(Math.abs(sim.getJointValue('/Motor')) < 1e-6);
            assert.ok(Math.abs(sim.getJointValue('/ScrewSlide')) < 1e-6);
            sim.play();
            for (let i = 0; i < 120; i++) step();
            assert.ok(
                sim.getJointValue('/Motor') > 600,
                'reset restores the authored forward drive and its limit window',
            );
        } finally {
            if (world) world.dispose();
            else sim.dispose();
        }
    });
test('multi-turn position drive crosses principal-angle seams and reverses', async () => {
    const data = screwSnapshot();
    data.joints[0].drive = {
        enabled: true,
        targetPosition: 1440,
        targetVelocity: 0,
        stiffness: 20,
        damping: 10,
    };
    const sim = await createSimulation({ rapier: R, snapshot: data });
    try {
        for (let i = 0; i < 2400; i++) sim.step(1 / 120);
        assert.ok(
            Math.abs(sim.getJointValue('/Motor') - 1440) < 1,
            `${sim.getJointValue('/Motor')}`,
        );
        sim.setJointTarget('/Motor', { position: 0 });
        for (let i = 0; i < 2400; i++) sim.step(1 / 120);
        assert.ok(Math.abs(sim.getJointValue('/Motor')) < 1);
    } finally {
        sim.dispose();
    }
});

for (const sign of [1, -1])
    test(`multi-turn range away from zero initializes and resets its valid turn (${sign})`, async () => {
        const data = offsetRotorSnapshot(sign);
        const sim = await createSimulation({ rapier: R, snapshot: data });
        try {
            assert.ok(
                Math.abs(sim.getJointValue('/Motor') - sign * 720) < 1e-5,
            );
            for (let i = 0; i < 1200; i++) sim.step(1 / 120);
            assert.ok(Math.abs(sim.getJointValue('/Motor') - sign * 900) < 1);
            sim.reset();
            assert.ok(
                Math.abs(sim.getJointValue('/Motor') - sign * 720) < 1e-5,
            );
            sim.play();
            for (let i = 0; i < 1200; i++) sim.step(1 / 120);
            assert.ok(Math.abs(sim.getJointValue('/Motor') - sign * 900) < 1);
        } finally {
            sim.dispose();
        }
    });

for (const shared of [false, true])
    test(`reset reapplies a nonzero mimic offset after restoring authored follower drive (${shared ? 'shared' : 'standalone'})`, async () => {
        const data = screwSnapshot();
        data.joints[0].drive = {
            enabled: true,
            targetPosition: 0,
            targetVelocity: 0,
            stiffness: 20,
            damping: 10,
        };
        data.joints[1].mimic = { joint: '/Motor', multiplier: 0, offset: 0.03 };
        data.joints[1].drive = {
            enabled: true,
            targetPosition: 0,
            targetVelocity: 0,
            stiffness: 100,
            damping: 20,
        };
        const world = shared
            ? createSimulationWorld({ rapier: R, gravity: [0, 0, 0] })
            : null;
        const sim = world
            ? await world.addAsset({ snapshot: data })
            : await createSimulation({ rapier: R, snapshot: data });
        const step = () => (world ? world.step(1 / 120) : sim.step(1 / 120));
        try {
            // Rapier may sleep within 0.5 mm of this 30 mm target; reset must preserve
            // the offset rather than leaving the authored follower target at zero.
            for (let i = 0; i < 1200; i++) step();
            assert.ok(
                Math.abs(sim.getJointValue('/ScrewSlide') - 0.03) < 5e-4,
                `offset follower: ${sim.getJointValue('/ScrewSlide')}`,
            );
            sim.reset();
            sim.play();
            for (let i = 0; i < 1200; i++) step();
            assert.ok(
                Math.abs(sim.getJointValue('/ScrewSlide') - 0.03) < 5e-4,
                `offset follower: ${sim.getJointValue('/ScrewSlide')}`,
            );
        } finally {
            if (world) world.dispose();
            else sim.dispose();
        }
    });
