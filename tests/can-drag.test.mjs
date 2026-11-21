import assert from 'node:assert/strict';
import {test} from 'node:test';
import R from '@dimforge/rapier3d-compat';
import {createMechanism} from '../src/kinematics.js';
import {createSimulation} from '../src/rapier.js';
await R.init();

const q=[0,0,0,1], zero=[0,0,0];
const box=path=>({path,position:zero,rotation:q,mass:1});
const shape=body=>({path:body+'/Shape',body,type:'cube',halfExtents:[.5,.5,.5],position:zero,rotation:q});
const lever=(limit={enabled:true,lower:0,upper:5})=>({metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],unsupported:[],
    bodies:[box('/Base'),box('/Lever'),box('/Badge')],shapes:[shape('/Base'),shape('/Lever'),shape('/Badge')],
    joints:[{path:'/Hinge',type:'revolute',body0:'/Base',body1:'/Lever',axis:'X',position0:zero,position1:zero,rotation0:q,rotation1:q,limit},
        {path:'/Glued',type:'fixed',body0:'/Base',body1:'/Badge',position0:zero,position1:zero,rotation0:q,rotation1:q}]});

test('a mechanism can drag a part only while playing and only when a movable joint moves it', async()=>{
    const m=await createMechanism({snapshot:lever()});
    try{
        assert.equal(m.canDrag('/Lever'),false,'not playing');
        m.play();
        assert.equal(m.canDrag('/Lever'),true);
        assert.equal(m.canDrag('/Base'),false,'the base has no joint to move it');
        assert.equal(m.canDrag('/Badge'),false,'fixed attachments do not move');
        assert.equal(m.canDrag('/Missing'),false);
        m.pause();assert.equal(m.canDrag('/Lever'),false);
        m.play();m.dispose();assert.equal(m.canDrag('/Lever'),false,'disposed');
    }finally{m.dispose();}
    const locked=await createMechanism({snapshot:lever({enabled:true,lower:2,upper:2})});
    try{locked.play();assert.equal(locked.canDrag('/Lever'),false,'a joint whose limits allow no motion');}finally{locked.dispose();}
});

test('canDrag agrees with beginDrag for mechanisms', async()=>{
    const m=await createMechanism({snapshot:lever()});
    try{
        m.play();
        for(const path of ['/Lever','/Base','/Badge','/Missing']){
            assert.equal(m.beginDrag(path,{x:0,y:0,z:0}),m.canDrag(path),path);m.endDrag();
        }
    }finally{m.dispose();}
});

test('a simulation can drag dynamic bodies only while playing', async()=>{
    const source=lever();source.bodies[0].kinematicBody=true;
    const s=await createSimulation({rapier:R,snapshot:source,mode:'interaction'});
    try{
        assert.equal(s.canDrag('/Lever'),false,'not playing');
        s.play();
        assert.equal(s.canDrag('/Lever'),true);
        assert.equal(s.canDrag('/Base'),false,'kinematic bodies are not dragged');
        assert.equal(s.canDrag('/Missing'),false);
        for(const path of ['/Lever','/Base','/Missing']){assert.equal(s.beginDrag(path,{x:0,y:0,z:0}),s.canDrag(path),path);s.endDrag();}
        s.pause();assert.equal(s.canDrag('/Lever'),false);
    }finally{s.dispose();}
    assert.equal(s.canDrag('/Lever'),false,'disposed');
});
