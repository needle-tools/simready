import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {createMechanism} from '../src/kinematics.js';

// A chair seat on a height slider carries a lever on a hinge, as on an office chair.
// Pulling the lever tip upward can lift the seat or turn the lever.
const identity=[0,0,0,1],zero=[0,0,0];
function chair({seat=1.5,lever=.2,spring=0}={}){
    return {metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],
        bodies:[{path:'/Seat',position:[0,.5,0],rotation:identity},{path:'/Lever',position:[.2,.5,0],rotation:identity}],
        shapes:[
            {path:'/SeatShape',body:'/Seat',type:'cube',halfExtents:[.2,.03,.2],position:zero,rotation:identity,mass:seat},
            {path:'/LeverShape',body:'/Lever',type:'cube',halfExtents:[.05,.01,.01],position:[.05,0,0],rotation:identity,mass:lever}],
        joints:[
            {path:'/Height',type:'prismatic',body0:'',body1:'/Seat',axis:'Y',position0:[0,.5,0],position1:zero,rotation0:identity,rotation1:identity,
                limit:{enabled:true,lower:-.1,upper:.1}},
            {path:'/Lever',type:'revolute',body0:'/Seat',body1:'/Lever',axis:'Z',position0:[.2,0,0],position1:zero,rotation0:identity,rotation1:identity,
                limit:{enabled:true,lower:-45,upper:45},
                ...spring&&{drive:{enabled:true,targetPosition:0,targetVelocity:0,stiffness:spring,damping:0}}},
        ]};
}

/** Pull the lever tip up by `distance` metres and report how far each joint moved. */
async function pull(options,distance=.001){
    const m=await createMechanism({snapshot:chair(options),dragMode:'point'});
    try{
        m.play();
        const tip=new Vector3(.3,.5,0);
        assert.equal(m.beginDrag('/Lever',tip),true);
        // The solve runs per pointer sample, as during a real drag.
        for(let i=1;i<=20;i++)m.moveDrag(tip.clone().add(new Vector3(0,distance*i/20,0)));
        m.endDrag();
        // Tip travel each joint accounts for: the lever turns about a 0.1 m arm.
        return {seat:m.getJointValue('/Height'),lever:m.getJointValue('/Lever')*Math.PI/180*.1};
    }finally{m.dispose();}
}

// A small pull keeps the lever's arc within the solver's tolerance, so either joint could follow it.
test('the lighter joint takes more of a drag that either joint could follow',async()=>{
    const light=await pull({seat:1.5,lever:.2});
    assert.ok(light.lever>light.seat*3,`a light lever turns first: lever ${light.lever}, seat ${light.seat}`);
    // The slider also carries the lever, so a heavier lever only shifts the share toward the seat.
    const heavy=await pull({seat:.2,lever:1.5});
    assert.ok(heavy.lever/heavy.seat<light.lever/light.seat/2,`a heavier lever turns less: ${heavy.lever/heavy.seat} vs ${light.lever/light.seat}`);
    for(const result of [light,heavy])assert.ok(Math.abs(result.seat+result.lever-.001)<2.5e-4,`the tip follows the pointer within the drag tolerance: ${result.seat+result.lever}`);
});

test('while dragging, the pointer wins over a drive; the drive keeps the pose it is left in',async()=>{
    const free=await pull({},.02),sprung=await pull({spring:.05},.02);
    assert.ok(Math.abs(sprung.lever-free.lever)<1e-6&&Math.abs(sprung.seat-free.seat)<1e-6,'a drive does not change the drag');
});
