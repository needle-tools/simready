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

test('mimic joints become couplings in description units', () => {
    const source = {...snapshot({}), bodies: [{path: '/Rack', position: [0, 0, 0], rotation: [0, 0, 0, 1]}, {path: '/Pinion', position: [0, 0, 1], rotation: [0, 0, 0, 1]}],
        joints: [{path: '/Slide', type: 'prismatic', body1: '/Rack'}, {path: '/Turn', type: 'revolute', body1: '/Pinion', mimic: {joint: '/Slide', multiplier: 90, offset: 10}}]};
    const withJoints = features => ({...capabilities(features), joints: new Set(['revolute', 'prismatic'])});
    // 90 degrees per unit of slide is π/2 radians per unit; the 10 degree offset becomes radians too.
    const turn = describeSimulation(source, {capabilities: {...withJoints([]), jointCoupling: 'emulated'}}).joints.find(joint => joint.id === '/Turn');
    assert.ok(Math.abs(turn.coupling.multiplier - Math.PI / 2) < 1e-9);
    assert.ok(Math.abs(turn.coupling.offset - 10 * Math.PI / 180) < 1e-9);
    const unsupported = describeSimulation(source, {capabilities: withJoints([])});
    assert.equal(unsupported.joints.find(joint => joint.id === '/Turn').coupling, undefined);
    assert.equal(unsupported.issues[0].reason, 'Mimic joint coupling is not supported by this physics backend.');
});

test('a mimic joint whose leader is left out moves freely', () => {
    const source = {...snapshot({}), joints: [{path: '/Turn', type: 'revolute', body1: '/Lamp', mimic: {joint: '/Missing', multiplier: 1, offset: 0}}]};
    const description = describeSimulation(source, {capabilities: {...capabilities([]), joints: new Set(['revolute']), jointCoupling: 'emulated'}});
    assert.equal(description.joints[0].coupling, undefined);
    assert.match(description.issues[0].reason, /leader is not simulated/);
});
