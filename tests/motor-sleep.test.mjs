import {test} from 'node:test';
import assert from 'node:assert/strict';
import R from '@dimforge/rapier3d-compat';
import {createSimulation,createSimulationWorld} from '../src/rapier.js';
await R.init();
const snapshot=()=>({metersPerUnit:1,kilogramsPerUnit:1,upAxis:'Y',scenes:[{path:'/Scene',gravityMagnitude:0,gravityDirection:[0,-1,0]}],materials:[],groups:[],unsupported:[],
    bodies:[{path:'/Rotor',position:[0,0,0],rotation:[0,0,0,1],mass:1}],
    shapes:[{path:'/Rotor/Shape',body:'/Rotor',type:'cube',halfExtents:[.1,.1,.1]}],
    joints:[{path:'/Motor',type:'revolute',body1:'/Rotor',axis:'Z',position0:[0,0,0],position1:[0,0,0],rotation0:[0,0,0,1],rotation1:[0,0,0,1],drive:{enabled:true,targetPosition:0,targetVelocity:24,stiffness:0,damping:10}}]});
for(const shared of [false,true])test(`slow velocity motor keeps driving, then permits sleep (${shared?'shared':'standalone'})`,async()=>{
    const world=shared?createSimulationWorld({rapier:R,gravity:[0,0,0]}):null;
    const sim=world?await world.addAsset({snapshot:snapshot()}):await createSimulation({rapier:R,snapshot:snapshot()});
    const step=()=>world?world.step(1/120):sim.step(1/120);
    try {
        for(let i=0;i<600;i++)step();
        assert.ok(Math.abs(sim.getJointValue('/Motor')-120)<.5,`${sim.getJointValue('/Motor')} instead of 120 degrees`);
        assert.equal(sim.bodies.get('/Rotor').body.isSleeping(),false);
        assert.equal(sim.setJointTarget('/Motor',{velocity:0}),true);
        for(let i=0;i<600;i++)step();
        assert.equal(sim.bodies.get('/Rotor').body.isSleeping(),true,'zero-speed motor should allow ordinary sleeping');
        assert.equal(sim.setJointTarget('/Motor',{velocity:-24}),true);
        const before=sim.getJointValue('/Motor');for(let i=0;i<600;i++)step();
        assert.ok(Math.abs(sim.getJointValue('/Motor')-(before-120))<.5);
    } finally {if(world)world.dispose();else sim.dispose();}
});
