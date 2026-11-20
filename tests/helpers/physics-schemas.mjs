import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';

const directory = new URL('../fixtures/khronos-physics/', import.meta.url);
const ajv = new Ajv2020({strict: false, allErrors: true});
for (const name of readdirSync(directory).filter(file => file.endsWith('.json'))) {
	ajv.addSchema(JSON.parse(readFileSync(new URL(name, directory), 'utf8')));
}

/** @typedef {{geometry?: {node?: number, shape?: number}}} GeometryOwner */
/** @param {{extensions?: Record<string, unknown>, nodes?: {extensions?: Record<string, unknown>}[]}} asset */
export function assertPhysicsSchemas(asset) {
	const physics = 'KHR_physics_rigid_bodies';
	const shapes = 'KHR_implicit_shapes';
	/** @param {string} schema @param {unknown} payload @param {string} location */
	function check(schema, payload, location) {
		if (payload === undefined) return;
		const validate = ajv.getSchema(schema + '.schema.json');
		assert.ok(validate, 'Missing schema: ' + schema);
		assert.ok(validate(payload), location + ': ' + ajv.errorsText(validate.errors));
	}
	const table = /** @type {{shapes?: unknown[]} | undefined} */ (asset.extensions?.[shapes]);
	check('glTF.' + shapes, table, shapes);
	check('glTF.' + physics, asset.extensions?.[physics], physics);
	for (const [i, node] of (asset.nodes ?? []).entries()) {
		const body = /** @type {Record<string, GeometryOwner> | undefined} */ (node.extensions?.[physics]);
		check('node.' + physics, body, 'nodes[' + i + ']');
		for (const role of ['collider', 'trigger']) {
			const geometry = body?.[role]?.geometry;
			if (geometry?.node !== undefined) assert.ok(asset.nodes?.[geometry.node]);
			if (geometry?.shape !== undefined) assert.ok(table?.shapes?.[geometry.shape]);
		}
	}
}
