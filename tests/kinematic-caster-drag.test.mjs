import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {createMechanism} from '../src/kinematics.js';

// An office-chair caster: a swivel about the vertical carries a tire that spins
// without limits, its axle behind the swivel axis.
const identity=[0,0,0,1],zero=[0,0,0];
function caster(){
    return {metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],shapes:[],
        bodies:[{path:'/Fork',position:[0,.1,0],rotation:identity},{path:'/Tire',position:[0,.03,-.025],rotation:identity}],
        joints:[
            {path:'/Swivel',type:'revolute',body0:'',body1:'/Fork',axis:'Y',position0:[0,.1,0],position1:zero,rotation0:identity,rotation1:identity},
            {path:'/Spin',type:'revolute',body0:'/Fork',body1:'/Tire',axis:'X',position0:[0,-.07,-.025],position1:zero,rotation0:identity,rotation1:identity},
        ]};
}

/** The largest per-step change of each joint along a straight drag, and the largest change
 * between consecutive steps. A smooth turning point keeps the second small; jumping between
 * poses on alternate pointer samples does not. */
function drag(mechanism,grab,direction,distance,steps=60){
    assert.equal(mechanism.beginDrag('/Tire',grab),true);
    const series=[['/Swivel','/Spin'].map(path=>mechanism.getJointValue(path))];
    for(let i=1;i<=steps;i++){
        mechanism.moveDrag(grab.clone().addScaledVector(direction,distance*i/steps));
        series.push(['/Swivel','/Spin'].map(path=>mechanism.getJointValue(path)));
    }
    mechanism.endDrag();
    return [0,1].map(j=>{
        const steps=series.slice(1).map((row,i)=>row[j]-series[i][j]);
        return {jerk:Math.max(...steps.slice(1).map((step,i)=>Math.abs(step-steps[i]))),largest:Math.max(...steps.map(Math.abs))};
    });
}

test('dragging a caster tire past its reach moves the swivel and spin without oscillating',async()=>{
    const m=await createMechanism({snapshot:caster(),dragMode:'point'});
    try{
        m.play();
        const rim=new Vector3(0,.055,-.025);
        // Across, along and diagonally to the axle, three tire radii beyond the rim.
        for(const direction of [new Vector3(1,0,0),new Vector3(0,0,1),new Vector3(1,0,1).normalize(),new Vector3(0,1,0)]){
            m.reset();m.play();
            for(const [i,{jerk,largest}] of drag(m,rim,direction,.075).entries()){
                const joint=['swivel','spin'][i];
                assert.ok(jerk<2,`${joint} step changes by ${jerk.toFixed(1)}° between samples toward ${direction.toArray()}`);
                assert.ok(largest<15,`${joint} jumps ${largest.toFixed(1)}° in one step toward ${direction.toArray()}`);
            }
        }
    }finally{m.dispose();}
});
