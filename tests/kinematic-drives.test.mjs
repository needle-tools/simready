import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {createMechanism} from '../src/kinematics.js';

// A lever on a fixed base whose authored drive target differs from its rest pose.
const identity=[0,0,0,1],zero=[0,0,0];
function lever({drive,limit=[-45,45],angularDamping}={}){
    return {metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],
        bodies:[{path:'/Lever',position:[0,0,0],rotation:identity,...angularDamping!==undefined&&{angularDamping}}],
        shapes:[{path:'/Shape',body:'/Lever',type:'cube',halfExtents:[.05,.01,.01],position:[.05,0,0],rotation:identity,mass:.2}],
        joints:[{path:'/Hinge',type:'revolute',body0:'',body1:'/Lever',axis:'Z',position0:zero,position1:zero,rotation0:identity,rotation1:identity,
            limit:{enabled:true,lower:limit[0],upper:limit[1]},
            drive:{enabled:true,targetPosition:-20,targetVelocity:0,stiffness:.01,damping:0,...drive}}]};
}
// Moment about the hinge: a 0.1 x 0.02 x 0.02 m bar of 0.2 kg centred 0.05 m out.
const inertia=.2*(.1**2+.02**2)/12+.2*.05**2;
const torquePerRadian=.01*180/Math.PI;

async function playing(snapshot){const m=await createMechanism({snapshot});m.play();return m;}

test('a drive moves its joint from the rest pose to its target at the drive spring\'s frequency',async()=>{
    const m=await playing(lever({angularDamping:0}));
    try{
        const dt=1/240,period=2*Math.PI*Math.sqrt(inertia/torquePerRadian);
        let t=0,crossing=null;
        while(t<period&&crossing===null){const before=m.getJointValue('/Hinge');m.update(dt);t+=dt;if(before>-20&&m.getJointValue('/Hinge')<=-20)crossing=t;}
        assert.ok(crossing!==null,'the lever reaches its target');
        assert.ok(Math.abs(crossing-period/4)<period*.03,`quarter period ${crossing} vs ${period/4}`);
    }finally{m.dispose();}
});

test('body damping settles an undamped drive, and drive damping settles it without overshoot',async()=>{
    for(const [name,snapshot,overshoot] of [['default body damping',lever(),true],['critical drive damping',lever({drive:{damping:2*Math.sqrt(torquePerRadian*inertia)/(180/Math.PI)}}),false]]){
        const m=await playing(snapshot);
        try{
            let lowest=Infinity;
            for(let i=0;i<60*120;i++){m.update(1/60);lowest=Math.min(lowest,m.getJointValue('/Hinge'));}
            assert.ok(Math.abs(m.getJointValue('/Hinge')+20)<.5,`${name} settles near the target: ${m.getJointValue('/Hinge')}`);
            assert.equal(lowest<-20.5,overshoot,`${name} overshoot: lowest ${lowest}`);
        }finally{m.dispose();}
    }
});

test('a force limit slows a stiff drive, and a limit stops it at the stop',async()=>{
    const limited=await playing(lever({drive:{stiffness:90,damping:0,forceLimit:.001}}));
    const free=await playing(lever({drive:{stiffness:90,damping:0}}));
    try{
        limited.update(1/60);free.update(1/60);
        assert.ok(limited.getJointValue('/Hinge')>free.getJointValue('/Hinge'),'the capped drive moves less in one frame');
    }finally{limited.dispose();free.dispose();}
    const m=await playing(lever({limit:[-10,45]}));
    try{
        for(let i=0;i<600;i++)m.update(1/60);
        assert.ok(Math.abs(m.getJointValue('/Hinge')+10)<1e-6,'the lever rests at its stop');
    }finally{m.dispose();}
});

test('posing keeps the pose: a typed value or a drag becomes the drive target until reset',async()=>{
    const m=await playing(lever());
    try{
        assert.equal(m.setJointValue('/Hinge',30),true);
        for(let i=0;i<600;i++)m.update(1/60);
        assert.ok(Math.abs(m.getJointValue('/Hinge')-30)<1e-3,`a typed pose holds: ${m.getJointValue('/Hinge')}`);
        assert.equal(m.beginDrag('/Lever',new Vector3(.1,0,0)),true);
        assert.equal(m.update(1/60),false,'a held joint does not relax');
        m.moveDrag(new Vector3(.1,0,0).applyAxisAngle(new Vector3(0,0,1),-Math.PI/9));
        const dragged=m.getJointValue('/Hinge');
        m.endDrag();
        for(let i=0;i<600;i++)m.update(1/60);
        assert.ok(Math.abs(m.getJointValue('/Hinge')-dragged)<1e-3,`a dragged pose holds: ${m.getJointValue('/Hinge')} vs ${dragged}`);
        m.reset();m.play();
        for(let i=0;i<60*120;i++)m.update(1/60);
        assert.ok(Math.abs(m.getJointValue('/Hinge')+20)<.5,'after reset the authored target applies again');
        m.pause();assert.equal(m.update(1/60),false);
    }finally{m.dispose();}
});

test('a slider drive pulls with its force per unit length',async()=>{
    const snapshot={metersPerUnit:.01,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],
        bodies:[{path:'/Seat',position:[0,0,0],rotation:identity}],
        shapes:[{path:'/Shape',body:'/Seat',type:'cube',halfExtents:[10,1,10],position:zero,rotation:identity,mass:2}],
        joints:[{path:'/Height',type:'prismatic',body0:'',body1:'/Seat',axis:'Y',position0:zero,position1:zero,rotation0:identity,rotation1:identity,
            limit:{enabled:true,lower:-10,upper:10},drive:{enabled:true,targetPosition:5,targetVelocity:0,stiffness:50,damping:20}}]};
    const m=await playing(snapshot);
    try{
        for(let i=0;i<60*5;i++)m.update(1/60);
        assert.ok(Math.abs(m.getJointValue('/Height')-5)<.05,`seat reaches its target: ${m.getJointValue('/Height')} cm`);
    }finally{m.dispose();}
});
