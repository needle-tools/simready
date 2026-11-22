import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {createMechanism} from '../src/kinematics.js';

// A wheel on a vertical swivel, seen from the front, where the drag plane contains the axis.
const identity=[0,0,0,1],zero=[0,0,0];
const swivel={metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],shapes:[],
    bodies:[{path:'/Fork',position:zero,rotation:identity}],
    joints:[{path:'/Swivel',type:'revolute',body0:'',body1:'/Fork',axis:'Y',position0:zero,position1:zero,rotation0:identity,rotation1:identity}]};

/** Largest per-step change while the pointer moves across the hinge in its drag plane. */
async function sweep(normal,grab=new Vector3(.01,0,.05)){
    const m=await createMechanism({snapshot:swivel});
    try{
        m.play();
        // The part is grabbed on its rim and dragged sideways, across the axis.
        assert.equal(m.beginDrag('/Fork',grab,normal&&{normal}),true);
        let previous=m.getJointValue('/Swivel'),largest=0;
        for(let i=1;i<=40;i++){
            m.moveDrag(grab.clone().add(new Vector3(-.08*i/40,0,0)));
            const value=m.getJointValue('/Swivel');largest=Math.max(largest,Math.abs(value-previous));previous=value;
        }
        return {largest,total:previous};
    }finally{m.dispose();}
}

test('a hinge seen edge-on rolls with the pointer instead of flipping where its path crosses the axis',async()=>{
    // Grabbed beside the axis, on the silhouette, the path crosses it.
    const beside=await sweep(new Vector3(0,0,-1),new Vector3(.05,0,.002));
    assert.ok(beside.largest<5,`steady steps beside the axis: ${beside.largest}°`);
    // 8 cm of travel at a 5 cm rim radius, turning the visible front with the pointer.
    assert.ok(Math.abs(Math.abs(beside.total)-.08/Math.hypot(.05,.002)*180/Math.PI)<3,`rolled ${beside.total}°`);
    const front=await sweep(new Vector3(0,0,-1));
    assert.ok(front.largest<5,`steady steps in front: ${front.largest}°`);
    assert.ok(Math.sign(front.total)===Math.sign(beside.total),'the front of the rim follows the pointer either way');
});

test('without a drag plane, or seen face-on, a hinge still follows the pointer around its axis',async()=>{
    const legacy=await sweep();
    // Projected onto the hinge's own plane the path stays clear of the axis and turns about it.
    assert.ok(Math.abs(legacy.total)>5);
    const above=await sweep(new Vector3(0,-1,0));
    assert.ok(Math.abs(above.total-legacy.total)<1e-6,'face-on matches the original mapping');
});
