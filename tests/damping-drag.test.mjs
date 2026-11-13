import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {createSimulation} from '../src/rapier.js';
import {validateSnapshot} from '../src/index.js';

await R.init();
const rotation = [0, 0, 0, 1];
const snapshot = (mass = 1) => ({metersPerUnit: 1, upAxis: 'Y',
	scenes: [{path: '/Scene', gravityMagnitude: 0}], materials: [], groups: [],
	bodies: [{path: '/Rotor', position: [0, 0, 0], rotation, mass}],
	shapes: [{path: '/Rotor/Shape', body: '/Rotor', type: 'cube', halfExtents: [.5, .1, .1], rotation}],
	joints: [{path: '/Axle', type: 'revolute', body1: '/Rotor', axis: 'Z', rotation0: rotation, rotation1: rotation}],
});

for (const mass of [.005, 2]) for (const dt of [1 / 120, 1 / 60])
	test(`off-centre grabs damp tangential rotation (${mass} kg, ${dt} s)`, async () => {
		const sim = await createSimulation({snapshot: snapshot(mass), rapier: R});
		try {
			sim.play();
			const body = sim.bodies.get('/Rotor').body;
			body.setAngvel({x: 0, y: 0, z: 4}, true);
			assert.equal(sim.beginDrag('/Rotor', {x: .5, y: 0, z: 0}), true);
			// A target on the axle cannot damp tangential motion through a
			// radial spring alone. The part must settle instead of orbiting it.
			sim.moveDrag({x: 0, y: 0, z: 0});
			for (let frame = 0; frame < Math.ceil(1 / dt); frame++) sim.step(dt);
			assert.ok(Math.abs(body.angvel().z) < .01, `grab kept spinning: ${body.angvel().z}`);
			const velocity = {...body.angvel()};
			sim.endDrag();
			assert.equal(body.linearDamping(), 0);
			assert.equal(body.angularDamping(), 0);
			assert.deepEqual({...body.angvel()}, velocity, 'release must not erase momentum');
		} finally { sim.dispose(); }
	});

test('authored damping slows free motion and survives drag, pause and reset', async () => {
	const source = snapshot();
	source.joints = [];
	Object.assign(source.bodies[0], {linearDamping: .5, angularDamping: 2});
	const sim = await createSimulation({snapshot: source, rapier: R});
	try {
		sim.play();
		const body = sim.bodies.get('/Rotor').body;
		body.setLinvel({x: 1, y: 0, z: 0}, true);
		body.setAngvel({x: 0, y: 0, z: 1}, true);
		for (let i = 0; i < 120; i++) sim.step(1 / 120);
		assert.ok(body.linvel().x > .55 && body.linvel().x < .65);
		assert.ok(body.angvel().z > .1 && body.angvel().z < .2);
		sim.beginDrag('/Rotor', body.translation());
		sim.pause();
		assert.equal(body.linearDamping(), .5);
		assert.equal(body.angularDamping(), 2);
		sim.reset();
		assert.equal(body.linearDamping(), .5);
		assert.equal(body.angularDamping(), 2);
	} finally { sim.dispose(); }
});

test('damping rejects invalid rates and preserves explicit zero', () => {
	for (const value of [-1, NaN, Infinity]) {
		const source = snapshot();
		source.bodies[0].angularDamping = value;
		assert.throws(() => validateSnapshot(source), /Invalid physics snapshot/);
	}
	const source = snapshot();
	source.bodies[0].angularDamping = 0;
	assert.equal(validateSnapshot(source), source);
});
