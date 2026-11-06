import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeUsdJointMetadata,decodeUsdJointMetadata} from '../src/usd.js';
import {createMechanism} from '../src/kinematics.js';

const decode=metadata=>decodeUsdJointMetadata(Object.fromEntries(metadata.attributes.map(a=>[a.name,a.value])),Object.fromEntries(metadata.relationships.map(r=>[r.name,r.targets])));
test('USD metadata remaps identities and preserves signed and mixed-unit couplings without mutating input',()=>{
    for(const multiplier of [-2,1,.003/360])for(const offset of [-10,0,.03]){
        const joint={mimic:{joint:'/Input',multiplier,offset}},before=structuredClone(joint);
        const metadata=encodeUsdJointMetadata(joint,path=>'/Asset'+path),actual=decode(metadata);
        assert.deepEqual(actual,{joint:'/Asset/Input',multiplier,offset});
        assert.deepEqual(joint,before);
        assert.deepEqual(metadata.relationships,[{name:'physxMimicJoint:rotX:referenceJoint',targets:['/Asset/Input']}]);
    }
});
test('USD metadata preserves legacy defaults and rejects malformed coupling data',()=>{
    assert.deepEqual(encodeUsdJointMetadata({}),{apiSchemas:[],attributes:[],relationships:[]});
    assert.equal(decodeUsdJointMetadata({},{}),undefined);
    assert.deepEqual(decodeUsdJointMetadata({},{'simready:coupledOf':['/Input']}),{joint:'/Input',multiplier:-1,offset:-0});
    assert.throws(()=>decodeUsdJointMetadata({},{'simready:mimicOf':['/A','/B']}),/exactly one/);
    for(const multiplier of [Infinity,NaN,'2'])assert.throws(()=>encodeUsdJointMetadata({mimic:{joint:'/Input',multiplier,offset:0}}),/finite/);
    assert.throws(()=>encodeUsdJointMetadata({mimic:{joint:'/Input',multiplier:1,offset:0}},()=>undefined),/absolute/);
    assert.throws(()=>decodeUsdJointMetadata({'simready:mimicGearing':'2'},{'simready:mimicOf':['/Input']}),/numbers/);
});
test('decoded USD metadata drives a gear and rack through the ordinary mechanism runtime',async()=>{
    const rotation=[0,0,0,1];
    const snapshot={metersPerUnit:.01,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],unsupported:[],shapes:[],
        bodies:['Input','Gear','Rack'].map((id,i)=>({path:'/'+id,position:[i,0,0],rotation})),
        joints:['Input','Gear','Rack'].map((id,i)=>({path:'/Joints/'+id,type:i===2?'prismatic':'revolute',axis:i===2?'X':'Z',body1:'/'+id,position0:[i,0,0],position1:[0,0,0],rotation0:rotation,rotation1:rotation}))};
    snapshot.joints[1].mimic=decode(encodeUsdJointMetadata({mimic:{joint:'/Joints/Input',multiplier:-2,offset:0}}));
    snapshot.joints[2].mimic=decode(encodeUsdJointMetadata({mimic:{joint:'/Joints/Gear',multiplier:.01,offset:0}}));
    const mechanism=await createMechanism({snapshot});
    try{
        assert.deepEqual(mechanism.unsupported,[]);
        assert.equal(mechanism.setJointValue('/Joints/Input',30),true);
        assert.ok(Math.abs(mechanism.getJointValue('/Joints/Gear')+60)<1e-5);
        assert.ok(Math.abs(mechanism.getJointValue('/Joints/Rack')+.6)<1e-6);
    }finally{mechanism.dispose();}
});
