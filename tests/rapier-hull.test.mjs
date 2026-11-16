import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {repairConvexCompound} from '../src/rapierHull.js';
await R.init();

test('rebuild rejected convex faces without changing compound points, transforms or valid parts', () => {
    const vertices = new Float32Array([0,0,0, 1,0,0, 0,1,0, 0,0,.001]);
    const invalid = R.ColliderDesc.convexMesh(vertices, new Uint32Array([0,0,0, 1,1,1, 2,2,2, 3,3,3])).shape;
    assert.equal(invalid.intoRaw(), undefined);
    const valid = R.ColliderDesc.ball(.2).shape;
    const positions = [{x:2,y:3,z:4}, {x:-2,y:0,z:0}], rotations = [{x:0,y:0,z:0,w:1}, {x:0,y:0,z:1,w:0}];
    const descriptor = new R.ColliderDesc(new R.Compound([invalid, valid], positions, rotations, 0));
    const adaptations = [];
    repairConvexCompound(R, descriptor, '/ThinPart', adaptations);
    assert.equal(descriptor.shape.shapes.length, 2);
    assert.equal(descriptor.shape.shapes[0].vertices, vertices);
    assert.equal(descriptor.shape.shapes[1], valid);
    assert.equal(descriptor.shape.positions, positions);
    assert.equal(descriptor.shape.rotations, rotations);
    assert.equal(descriptor.shape.flags, 0);
    assert.equal(adaptations.length, 1);
    assert.equal(adaptations[0].path, '/ThinPart');
    const world = new R.World({x:0,y:0,z:0});
    try {
        const collider = world.createCollider(descriptor);
        assert.equal(collider.shape.shapes.length, 2);
        assert.ok(collider.volume() > 0);
        repairConvexCompound(R, descriptor, '/ThinPart', adaptations);
        assert.equal(adaptations.length, 1, 'valid rebuilt parts stay unchanged');
    } finally { world.free(); }
});

test('unrepairable decomposition fails with its source path instead of discarding a part', () => {
    assert.throws(() => repairConvexCompound(R, {shape:{shapes:[{intoRaw:()=>null}]}}, '/Broken', []), /hull 0 at \/Broken/);
});

test('retains a zero-volume two-point decomposition hull as an exact segment', () => {
    const vertices = new Float32Array([.1,.2,.3, .1,.2,1.3]);
    const invalid = R.ColliderDesc.convexMesh(vertices, new Uint32Array([0,1,0,1,0,0])).shape;
    assert.equal(invalid.intoRaw(), undefined);
    const descriptor = new R.ColliderDesc(new R.Compound([invalid], [{x:0,y:0,z:0}], [{x:0,y:0,z:0,w:1}]));
    const adaptations=[];
    repairConvexCompound(R,descriptor,'/Line',adaptations);
    const part=descriptor.shape.shapes[0];
    assert.deepEqual({...part.a},{x:vertices[0],y:vertices[1],z:vertices[2]});
    assert.deepEqual({...part.b},{x:vertices[3],y:vertices[4],z:vertices[5]});
    assert.equal(adaptations[0].target,'segment');
    const world=new R.World({x:0,y:0,z:0});
    try{const collider=world.createCollider(descriptor);assert.equal(collider.volume(),0);world.step();}finally{world.free();}
});
