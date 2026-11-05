import assert from 'node:assert/strict';
import {test} from 'node:test';
import {describeSimulation} from '../src/description.js';
import {validateSnapshot} from '../src/index.js';

const capabilities = features => ({backend: 'test', shapes: new Set(['box']), joints: new Set(['fixed', 'spherical']), features: new Set(features)});
const snapshot = joint => ({metersPerUnit: 1, kilogramsPerUnit: 1, upAxis: 'Y', scenes: [], materials: [], groups: [], shapes: [],
    bodies: [{path: '/Lamp', position: [0, -1, 0], rotation: [0, 0, 0, 1]}], joints: [{path: '/Socket', type: 'spherical', body1: '/Lamp', ...joint}]});

test('spherical cone limits from the joint limit use the smaller authored angle on backends with spherical limits', () => {
    const source = snapshot({axis: 'Y', limit: {enabled: true, lower: 30, upper: 20}});
    validateSnapshot(source);
    const description = describeSimulation(source, {capabilities: capabilities(['sphericalLimits'])});
    assert.equal(description.joints[0].coneLimit, 20 * Math.PI / 180);
    assert.deepEqual(description.issues, []);
    assert.equal(description.adaptations[0].target, 'circular cone limit');
    // A negative angle leaves that direction unlimited; the other one still applies.
    assert.equal(describeSimulation(snapshot({limit: {enabled: true, lower: -1, upper: 45}}), {capabilities: capabilities(['sphericalLimits'])}).joints[0].coneLimit, Math.PI / 4);
    assert.equal(describeSimulation(snapshot({limit: {enabled: false, lower: -1, upper: -1}}), {capabilities: capabilities([])}).joints[0].coneLimit, undefined);
});

test('backends without spherical limits report the cone limit and leave the joint out', () => {
    const description = describeSimulation(snapshot({limit: {enabled: true, lower: 25, upper: 25}}), {capabilities: capabilities([])});
    assert.deepEqual(description.joints, []);
    assert.equal(description.issues[0].reason, 'Spherical joint cone limits are not supported.');
});

test('break thresholds reach backends that can break joints', () => {
    const description = describeSimulation(snapshot({type: 'fixed', breakForce: 50, breakTorque: 5}), {capabilities: capabilities(['jointBreaking'])});
    assert.equal(description.joints[0].breakForce, 50);
    assert.equal(description.joints[0].breakTorque, 5);
    assert.deepEqual(description.issues, []);
});
