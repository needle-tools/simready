import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {createSimulation, createSimulationWorld, getSimulationLimitations} from '../src/rapier.js';

await R.init();
const q = [0, 0, 0, 1];
/** A gripper: the left finger is driven to 30 degrees and the right finger mirrors it as a mimic joint. */
const gripper = () => ({metersPerUnit: 1, kilogramsPerUnit: 1, upAxis: 'Y', materials: [], groups: [], unsupported: [],
    scenes: [{path: '/Scene', gravityMagnitude: 0, gravityDirection: [0, -1, 0]}],
    bodies: [{path: '/Left', position: [-.5, 0, 0], rotation: q}, {path: '/Right', position: [.5, 0, 0], rotation: q}],
    shapes: [{path: '/Left/Shape', body: '/Left', type: 'cube', halfExtents: [.05, .3, .05], position: [0, .3, 0], rotation: q},
        {path: '/Right/Shape', body: '/Right', type: 'cube', halfExtents: [.05, .3, .05], position: [0, .3, 0], rotation: q}],
    joints: [
        {path: '/LeftHinge', type: 'revolute', body1: '/Left', axis: 'Z', position0: [-.5, 0, 0], position1: [0, 0, 0], rotation0: q, rotation1: q,
            drive: {enabled: true, targetPosition: 30, targetVelocity: 0, stiffness: 400, damping: 40, acceleration: true}},
        {path: '/RightHinge', type: 'revolute', body1: '/Right', axis: 'Z', position0: [.5, 0, 0], position1: [0, 0, 0], rotation0: q, rotation1: q,
            mimic: {joint: '/LeftHinge', multiplier: -1, offset: 0}},
    ]});

test('mimic joints no longer make an asset unsupported', () => {
    assert.deepEqual(getSimulationLimitations(gripper()), []);
});

test('a mimic finger follows its leader in a standalone simulation', async () => {
    const sim = await createSimulation({rapier: R, snapshot: gripper()});
    try {
        assert.deepEqual(sim.unsupported, []);
        assert.equal(sim.backend.adaptations.find(item => item.source === 'joint coupling')?.path, '/RightHinge');
        sim.play();
        for (let i = 0; i < 360; i++) sim.step();
        assert.ok(Math.abs(sim.getJointValue('/LeftHinge') - 30) < 1);
        assert.ok(Math.abs(sim.getJointValue('/RightHinge') + 30) < 1);
        // A new target on the leader moves the follower too.
        sim.setJointTarget('/LeftHinge', {position: 10});
        for (let i = 0; i < 360; i++) sim.step();
        assert.ok(Math.abs(sim.getJointValue('/RightHinge') + 10) < 1);
    } finally { sim.dispose(); }
});

test('a mimic finger follows its leader in a shared world', async () => {
    const world = createSimulationWorld({rapier: R, gravity: [0, 0, 0]});
    try {
        const asset = await world.addAsset({snapshot: gripper()});
        for (let i = 0; i < 360; i++) world.step();
        assert.ok(Math.abs(asset.getJointValue('/RightHinge') + 30) < 1);
    } finally { world.dispose(); }
});
