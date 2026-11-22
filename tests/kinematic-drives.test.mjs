import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Vector3} from 'three';
import {createMechanism} from '../src/kinematics.js';

// A lever on a fixed base with a return drive, like an office chair's height lever.
const identity=[0,0,0,1],zero=[0,0,0];
function lever({drive,limit=[-45,45],angularDamping}={}){
    return {metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],
        bodies:[{path:'/Lever',position:[0,0,0],rotation:identity,...angularDamping!==undefined&&{angularDamping}}],
        shapes:[{path:'/Shape',body:'/Lever',type:'cube',halfExtents:[.05,.01,.01],position:[.05,0,0],rotation:identity,mass:.2}],
        joints:[{path:'/Hinge',type:'revolute',body0:'',body1:'/Lever',axis:'Z',position0:zero,position1:zero,rotation0:identity,rotation1:identity,
            limit:{enabled:true,lower:limit[0],upper:limit[1]},
            drive:{enabled:true,targetPosition:0,targetVelocity:0,stiffness:.01,damping:0,...drive}}]};
}
// Moment about the hinge: a 0.1 x 0.02 x 0.02 m bar of 0.2 kg centred 0.05 m out.
const inertia=.2*(.1**2+.02**2)/12+.2*.05**2;
const torquePerRadian=.01*180/Math.PI;

async function released(snapshot,start=20,path='/Hinge'){
    const m=await createMechanism({snapshot});
    m.play();
    assert.equal(m.setJointValue(path,start),true);
    return m;
}

test('a released lever swings back to its drive target at the drive spring\'s frequency',async()=>{
    const m=await released(lever({angularDamping:0}));
    try{
        const dt=1/240,period=2*Math.PI*Math.sqrt(inertia/torquePerRadian);
        let t=0,crossing=null;
        while(t<period&&crossing===null){const before=m.getJointValue('/Hinge');m.update(dt);t+=dt;if(before>0&&m.getJointValue('/Hinge')<=0)crossing=t;}
        assert.ok(crossing!==null,'the lever passes its target');
        assert.ok(Math.abs(crossing-period/4)<period*.03,`quarter period ${crossing} vs ${period/4}`);
    }finally{m.dispose();}
});

test('body damping settles an undamped drive, and drive damping settles it without overshoot',async()=>{
    for(const [name,snapshot,overshoot] of [['default body damping',lever(),true],['critical drive damping',lever({drive:{damping:2*Math.sqrt(torquePerRadian*inertia)/(180/Math.PI)}}),false]]){
        const m=await released(snapshot);
        try{
            let lowest=Infinity;
            for(let i=0;i<60*120;i++){m.update(1/60);lowest=Math.min(lowest,m.getJointValue('/Hinge'));}
            assert.ok(Math.abs(m.getJointValue('/Hinge'))<.5,`${name} settles near the target: ${m.getJointValue('/Hinge')}`);
            assert.equal(lowest<-.5,overshoot,`${name} overshoot: lowest ${lowest}`);
            assert.equal(m.update(1/60)&&Math.abs(m.getJointValue('/Hinge'))<1e-4,false);
        }finally{m.dispose();}
    }
});

test('limits stop a relaxing joint, and holding it in a drag or a slider keeps it',async()=>{
    const m=await released(lever({limit:[5,45]}));
    try{
        for(let i=0;i<600;i++)m.update(1/60);
        assert.ok(Math.abs(m.getJointValue('/Hinge')-5)<1e-6,'the lever rests at its stop');
        m.setJointValue('/Hinge',30);
        assert.equal(m.beginDrag('/Lever',new Vector3(.1,.05,0)),true);
        assert.equal(m.update(1/60),false);
        assert.ok(Math.abs(m.getJointValue('/Hinge')-30)<1e-4,'a held lever stays where the drag left it');
        m.endDrag();
        assert.equal(m.update(1/60),true);
        assert.ok(m.getJointValue('/Hinge')<30);
        m.pause();assert.equal(m.update(1/60),false);
    }finally{m.dispose();}
});

test('a slider drive pulls back with its force per unit length',async()=>{
    const snapshot={metersPerUnit:.01,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],
        bodies:[{path:'/Seat',position:[0,0,0],rotation:identity}],
        shapes:[{path:'/Shape',body:'/Seat',type:'cube',halfExtents:[10,1,10],position:zero,rotation:identity,mass:2}],
        joints:[{path:'/Height',type:'prismatic',body0:'',body1:'/Seat',axis:'Y',position0:zero,position1:zero,rotation0:identity,rotation1:identity,
            limit:{enabled:true,lower:-10,upper:10},drive:{enabled:true,targetPosition:0,targetVelocity:0,stiffness:50,damping:20}}]};
    const m=await released(snapshot,5,'/Height');
    try{
        for(let i=0;i<60*5;i++)m.update(1/60);
        assert.ok(Math.abs(m.getJointValue('/Height'))<.05,`seat returns: ${m.getJointValue('/Height')} cm`);
    }finally{m.dispose();}
});
