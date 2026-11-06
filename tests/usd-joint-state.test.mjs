import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3} from 'three';
import {getUsdJointState,prepareUsdPhysicsSnapshot,encodeUsdJointMetadata} from '../src/usd.js';
import {screwSnapshot,offsetRotorSnapshot} from './helpers/continuous-motion.mjs';
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('rest angular states preserve principal rest and choose nearest valid positive/negative turns',()=>{
    const wide=screwSnapshot();near(getUsdJointState(wide,wide.joints[0]).position,0);
    for(const sign of [1,-1]){const s=offsetRotorSnapshot(sign);near(getUsdJointState(s,s.joints[0]).position,sign*720);}
    wide.bodies[0].rotation=[0,0,0,-1];near(getUsdJointState(wide,wide.joints[0]).position,0);
});
test('rest angular state measures independent frames and world angular velocity including reversed endpoints',()=>{
    const s=screwSnapshot(),j=s.joints[0];
    const a=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.4),b=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.3);
    j.rotation0=a.toArray();j.rotation1=b.toArray();
    s.bodies[0].rotation=a.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),Math.PI/6)).multiply(b.clone().invert()).toArray();
    s.bodies[0].angularVelocity=new Vector3(0,0,25).applyQuaternion(a).toArray();
    let state=getUsdJointState(s,j);near(state.position,30);near(state.velocity,25);
    j.body0=j.body1;delete j.body1;[j.rotation0,j.rotation1]=[j.rotation1,j.rotation0];j.limit={enabled:true,lower:-100,upper:100};
    state=getUsdJointState(s,j);near(state.position,-30);near(state.velocity,-25);
});
test('rest prismatic state includes offset anchors and their tangential velocities',()=>{
    const s=screwSnapshot(),j=s.joints[1];j.position0=[0,.4,0];j.position1=[0,1,0];s.bodies[1].position=[.02,-.6,0];
    s.bodies[1].linearVelocity=[2,0,0];s.bodies[1].angularVelocity=[0,0,180];
    const state=getUsdJointState(s,j);near(state.position,.02);near(state.velocity,2-Math.PI);
    assert.equal(getUsdJointState(s,{...j,type:'fixed'}),null);
});
test('selected articulation scalar states become official JointStateAPI fields without changing source',()=>{
    const s=screwSnapshot();s.bodies[1].position[0]=.02;const planned=prepareUsdPhysicsSnapshot(s);
    const rotor=planned.joints.find(j=>j.path==='/Motor'),slide=planned.joints.find(j=>j.path==='/ScrewSlide');
    near(rotor.usdJointState.position,0);near(slide.usdJointState.position,.02);
    assert.equal(s.joints[0].usdJointState,undefined);
    const encoded=encodeUsdJointMetadata(slide);
    assert.ok(encoded.apiSchemas.includes('PhysicsJointStateAPI:linear'));
    assert.deepEqual(encoded.attributes.find(a=>a.name==='state:linear:physics:position'),{name:'state:linear:physics:position',type:'float',value:.02});
    assert.ok(encodeUsdJointMetadata(rotor).apiSchemas.includes('PhysicsJointStateAPI:angular'));
    assert.equal(planned.joints.find(j=>j.articulationRoot).usdJointState,undefined);
});

test('explicit profile state option covers uncoupled joints while core-only export stays unchanged',()=>{
    const s=screwSnapshot();delete s.joints[1].mimic;s.joints.push({path:'/Disabled',type:'revolute',body1:'/Rotor',jointEnabled:false});
    const plain=prepareUsdPhysicsSnapshot(s),stateful=prepareUsdPhysicsSnapshot(s,{jointState:true});
    assert.ok(plain.joints.every(j=>j.usdJointState===undefined));
    assert.deepEqual(stateful.joints[0].usdJointState,{position:0,velocity:0});
    assert.deepEqual(stateful.joints[1].usdJointState,{position:0,velocity:0});
    assert.equal(stateful.joints[2].usdJointState,undefined);
});
