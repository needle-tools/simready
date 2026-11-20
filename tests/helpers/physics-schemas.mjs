import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const directory = new URL('../fixtures/khronos-physics/', import.meta.url);
const ajv = new Ajv2020({strict: false, allErrors: true});
for (const name of readdirSync(directory).filter(file => file.endsWith('.json'))) {
	ajv.addSchema(JSON.parse(readFileSync(new URL(name, directory), 'utf8')));
}

export function assertPhysicsSchemas(asset) {
	const physics = 'KHR_physics_rigid_bodies';
	const shapes = 'KHR_implicit_shapes';
	function check(schema, payload, location) {
		if (payload === undefined) return;
		const validate = ajv.getSchema(schema + '.schema.json');
		assert.ok(validate(payload), location + ': ' + ajv.errorsText(validate.errors));
	}
	check('glTF.' + shapes, asset.extensions?.[shapes], shapes);
	check('glTF.' + physics, asset.extensions?.[physics], physics);
	for (const [i, node] of (asset.nodes ?? []).entries()) {
		const body = node.extensions?.[physics];
		check('node.' + physics, body, 'nodes[' + i + ']');
		for (const role of ['collider', 'trigger']) {
			const geometry = body?.[role]?.geometry;
			if (geometry?.node !== undefined) assert.ok(asset.nodes[geometry.node]);
			if (geometry?.shape !== undefined) assert.ok(asset.extensions?.[shapes]?.shapes[geometry.shape]);
		}
	}
}
