import {test} from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {createSimulation, createSimulationWorld} from '../src/rapier.js';
import {offsetRotorSnapshot} from './helpers/continuous-motion.mjs';
await R.init();

for (const shared of [false, true]) for (const type of ['fixed', 'spherical'])
    test(`${type} joints have no scalar coordinate (${shared ? 'shared' : 'standalone'})`, async () => {
        const snapshot = offsetRotorSnapshot(1);
        snapshot.joints[0].type = type;
        delete snapshot.joints[0].drive;
        delete snapshot.joints[0].limit;
        const world = shared ? createSimulationWorld({rapier: R, gravity: [0, 0, 0]}) : null;
        const sim = world ? await world.addAsset({snapshot}) : await createSimulation({rapier: R, snapshot});
        try {
            assert.equal(sim.getJointValue('/Motor'), null);
            assert.equal(sim.getJointValue('/Missing'), null);
            if (world) world.step(1 / 120); else sim.step(1 / 120);
            assert.equal(sim.getJointValue('/Motor'), null);
            sim.reset();
            assert.equal(sim.getJointValue('/Motor'), null);
        } finally {
            if (world) world.dispose(); else sim.dispose();
        }
    });
