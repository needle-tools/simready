import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion, Vector3} from 'three';
import {createMechanism} from '../src/kinematics.js';

for (const reversed of [false, true]) test(`an inconsistent fixed attachment preserves its rest offset without blocking valid hinges (reversed: ${reversed})`, async () => {
    const snapshot = {
        metersPerUnit: 1,
        bodies: [
            {path: '/Base', position: [0, 0, 0], rotation: [0, 0, 0, 1], kinematicBody: true},
            {path: '/Arm', position: [0, 1, 0], rotation: [0, 0, 0, 1]},
            {path: '/Lens', position: [.000012, .999985, -.0006], rotation: new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), .2).toArray()},
        ],
        joints: [
            {path: '/Hinge', type: 'revolute', axis: 'Z', body0: '/Base', body1: '/Arm', position0: [0, 1, 0], limit: {enabled: true, lower: 0, upper: 95}},
            {path: '/Weld', type: 'fixed', body0: reversed ? '/Lens' : '/Arm', body1: reversed ? '/Arm' : '/Lens'},
        ],
    };
    const original = structuredClone(snapshot);
    const mechanism = await createMechanism({snapshot});
    try {
        assert.deepEqual(mechanism.unsupported, []);
        assert.equal(mechanism.adaptations[0].path, '/Weld');
        const lens = mechanism.bodies.get('/Lens').body;
        const restOffset = new Vector3(...snapshot.bodies[2].position).sub(new Vector3(...snapshot.bodies[1].position));
        assert.ok(new Vector3().copy(lens.translation()).distanceTo(new Vector3(...snapshot.bodies[2].position)) < 1e-6);
        mechanism.play();
        assert.equal(mechanism.beginDrag('/Arm', new Vector3(1, 1, 0)), true);
        mechanism.moveDrag(new Vector3(0, 2, 0));
        mechanism.endDrag();
        assert.ok(Math.abs(mechanism.getJointValue('/Hinge') - 90) < 1e-3);
        const expected = restOffset.applyQuaternion(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)).add(new Vector3(0, 1, 0));
        assert.ok(new Vector3().copy(lens.translation()).distanceTo(expected) < 1e-6);
        const expectedRotation = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2).multiply(new Quaternion(...snapshot.bodies[2].rotation));
        assert.ok(new Quaternion().copy(lens.rotation()).normalize().angleTo(expectedRotation) < 1e-6);
        assert.equal(mechanism.setJointValue('/Hinge', 180), true);
        assert.ok(Math.abs(mechanism.getJointValue('/Hinge') - 95) < 1e-3);
        mechanism.reset();
        assert.ok(new Vector3().copy(lens.translation()).distanceTo(new Vector3(...snapshot.bodies[2].position)) < 1e-6);
        assert.deepEqual(snapshot, original);
    } finally {mechanism.dispose();}
});

test('inconsistent movable joint frames still reject manipulation', async () => {
    const mechanism = await createMechanism({framePolicy: 'strict', snapshot: {metersPerUnit: 1,
        bodies: [{path: '/Arm', position: [0, .01, 0], rotation: [0, 0, 0, 1]}],
        joints: [{path: '/Hinge', type: 'revolute', axis: 'Z', body1: '/Arm'}],
    }});
    try {
        assert.match(mechanism.unsupported[0].reason, /do not agree/);
        assert.equal(mechanism.setJointValue('/Hinge', 45), false);
    } finally {mechanism.dispose();}
});

for (const reversed of [false, true]) test(`rest-pose adaptation keeps off-axis attachments assembled and draggable (reversed: ${reversed})`, async () => {
    const source = {metersPerUnit: 1, bodies: [
        {path:'/Base',position:[0,0,0],rotation:[0,0,0,1],kinematicBody:true},
        {path:'/Arm',position:[.001,1,0],rotation:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.1).toArray()},
    ],joints:[{path:'/Hinge',type:'revolute',axis:'Z',body0:reversed?'/Arm':'/Base',body1:reversed?'/Base':'/Arm',position0:reversed?[0,0,0]:[0,1,0],position1:reversed?[0,1,0]:[0,0,0]}]};
    const before=structuredClone(source),mechanism=await createMechanism({snapshot:source});
    try{
        assert.deepEqual(mechanism.unsupported,[]);assert.equal(mechanism.adaptations[0].path,'/Hinge');
        const arm=mechanism.bodies.get('/Arm').body;
        assert.ok(new Vector3().copy(arm.translation()).distanceTo(new Vector3(...source.bodies[1].position))<1e-6);
        assert.equal(mechanism.setJointValue('/Hinge',90),true);
        const expected=new Vector3(.001,0,0).applyAxisAngle(new Vector3(0,0,1),reversed?-Math.PI/2:Math.PI/2).add(new Vector3(0,1,0));
        assert.ok(new Vector3().copy(arm.translation()).distanceTo(expected)<1e-6);
        mechanism.reset();assert.ok(new Vector3().copy(arm.translation()).distanceTo(new Vector3(...source.bodies[1].position))<1e-6);
        assert.deepEqual(source,before);
    }finally{mechanism.dispose();}
});

test('out-of-range rest coordinates retain the body pose without widening authored travel',async()=>{
 const snapshot={metersPerUnit:1,bodies:[{path:'/Button',position:[.003,0,0],rotation:[0,0,0,1]}],joints:[{path:'/Slide',body1:'/Button',type:'prismatic',axis:'X',limit:{enabled:true,lower:0,upper:.001}}]};
 const mechanism=await createMechanism({snapshot});
 try{
  assert.deepEqual(mechanism.unsupported,[]);assert.ok(Math.abs(mechanism.getJointValue('/Slide')-.001)<1e-8);
  assert.ok(Math.abs(mechanism.bodies.get('/Button').body.translation().x-.003)<1e-8);
  assert.equal(mechanism.setJointValue('/Slide',-.01),true);assert.equal(mechanism.getJointValue('/Slide'),0);
  assert.ok(Math.abs(mechanism.bodies.get('/Button').body.translation().x-.002)<1e-8);
  mechanism.reset();assert.ok(Math.abs(mechanism.bodies.get('/Button').body.translation().x-.003)<1e-8);
 }finally{mechanism.dispose();}
});
