import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareUsdPhysicsSnapshot,encodeUsdJointMetadata,decodeUsdJointMetadata} from '../src/usd.js';
import {getSnapshotIssues} from '../src/index.js';
import {screwSnapshot} from './helpers/continuous-motion.mjs';

const prepare=()=>prepareUsdPhysicsSnapshot(screwSnapshot());
test('grounded gear/rack branches become one fixed articulation without changing source or anchors',()=>{
    const source=screwSnapshot(),before=structuredClone(source),out=prepareUsdPhysicsSnapshot(source);
    assert.deepEqual(source,before);
    const base=out.bodies.find(b=>b.usdSyntheticBase),root=out.joints.find(j=>j.articulationRoot);
    assert.deepEqual(base.position,[0,0,0]);assert.deepEqual(base.rotation,[0,0,0,1]);
    assert.equal(base.rigidBodyEnabled,true);assert.equal(base.kinematicBody,false);
    assert.equal(root.type,'fixed');assert.equal(root.body1,base.path);assert.equal(root.body0,undefined);
    for(const original of source.joints){const j=out.joints.find(j=>j.path===original.path);assert.equal(j.body0,base.path);assert.deepEqual(j.position0,original.position0);assert.deepEqual(j.rotation0,original.rotation0);assert.deepEqual(j.limit,original.limit);}
    assert.equal(out.articulations.length,1);assert.equal(out.articulations[0].articulatedJoints.length,3);
    assert.deepEqual(getSnapshotIssues(out),[]);
});
test('native fields retain mixed angular/linear units and signed offsets at centimeter stage scale',()=>{
    const source=screwSnapshot();source.metersPerUnit=.01;
    source.joints[1].mimic={joint:'/Motor',multiplier:.3/360,offset:2};
    const out=prepareUsdPhysicsSnapshot(source),record=out.joints[1],encoded=encodeUsdJointMetadata(record);
    assert.deepEqual(encoded.apiSchemas,['PhysicsJointStateAPI:linear','PhysxMimicJointAPI:rotX']);
    const attrs=Object.fromEntries(encoded.attributes.map(a=>[a.name,a.value]));
    assert.equal(attrs['physxMimicJoint:rotX:gearing'],-.3/360);
    assert.equal(attrs['physxMimicJoint:rotX:offset'],-2);
    assert.equal(attrs['physxMimicJoint:rotX:naturalFrequency'],-1);
    assert.equal(attrs['physxMimicJoint:rotX:dampingRatio'],-1);
    const decoded=decodeUsdJointMetadata(attrs,Object.fromEntries(encoded.relationships.map(r=>[r.name,r.targets])));
    assert.equal(decoded.multiplier*720+decoded.offset,2.6);
});
test('a nonmandatory loop closure is excluded while both mimic edges stay in the tree',()=>{
    const source=screwSnapshot();source.joints.unshift({path:'/Closure',type:'fixed',body0:'/Rotor',body1:'/Slide'});
    const out=prepareUsdPhysicsSnapshot(source);
    assert.equal(out.joints.find(j=>j.path==='/Closure').excludeFromArticulation,true);
    assert.ok(out.joints.filter(j=>['/Motor','/ScrewSlide'].includes(j.path)).every(j=>!j.excludeFromArticulation));
});
test('mandatory mimic/reference cycles reject rather than exclude a coupling edge',()=>{
    const source=screwSnapshot();source.joints[1].body0='/Rotor';source.joints[1].body1='/Rotor';
    assert.throws(()=>prepareUsdPhysicsSnapshot(source),/cycle/);
});
test('connected floating mechanisms retain floating root and require no fabricated ground',()=>{
    const source=screwSnapshot();source.bodies.push({path:'/Base',position:[0,0,0],rotation:[0,0,0,1]});
    source.joints.forEach(j=>j.body0='/Base');
    const out=prepareUsdPhysicsSnapshot(source);
    assert.equal(out.bodies.length,3);assert.equal(out.joints.length,2);
    assert.equal(out.bodies.filter(b=>b.articulationRoot).length,1);
    assert.deepEqual(getSnapshotIssues(out),[]);
});
test('planner rejects unavailable native semantics without converting kinematic bases',()=>{
    const changes=[
        [s=>{s.joints[1].limit.lower=s.joints[1].limit.upper;},/nonempty/],
        [s=>{s.joints[0].jointEnabled=false;},/enabled articulation/],
        [s=>{s.bodies[0].kinematicBody=true;},/kinematic/],
        [s=>{s.bodies[0].rigidBodyEnabled=false;},/disabled/],
        [s=>{s.joints[0].excludeFromArticulation=true;},/enabled articulation/],
        [s=>{s.joints[1].mimic.multiplier=0;},/nonzero/],
        [s=>{s.joints[0].mimic={joint:'/ScrewSlide',multiplier:1,offset:0};},/dependency cycle/],
        [s=>{s.articulations=[{path:'/Old',rootPrims:[],filteredCollisions:[],articulatedJoints:['/Motor'],articulatedBodies:['/Rotor']}];},/existing articulation/],
    ];
    for(const [change,message] of changes){const source=screwSnapshot();change(source);assert.throws(()=>prepareUsdPhysicsSnapshot(source),message);}
});
test('disconnected floating couplings reject and unrelated grounded components remain untouched',()=>{
    const source=screwSnapshot();source.bodies.push({path:'/FloatingBase',position:[0,0,0],rotation:[0,0,0,1]});source.joints[1].body0='/FloatingBase';
    assert.throws(()=>prepareUsdPhysicsSnapshot(source),/disconnected floating/);
    const other=screwSnapshot();other.bodies.push({path:'/Unrelated',position:[1,2,3],rotation:[0,0,0,1]});other.joints.push({path:'/Other',type:'fixed',body1:'/Unrelated'});
    const out=prepareUsdPhysicsSnapshot(other);assert.deepEqual(out.joints.find(j=>j.path==='/Other'),other.joints.at(-1));
});
test('generated identities avoid collisions and native mimic preserves authored follower forces',()=>{
    const source=screwSnapshot();source.bodies.push({path:'/__UsdMimicBase',position:[0,0,0],rotation:[0,0,0,1]});
    source.joints[1].drive={enabled:true,targetPosition:0,targetVelocity:0,stiffness:100,damping:10};
    const out=prepareUsdPhysicsSnapshot(source);assert.equal(out.bodies.find(b=>b.usdSyntheticBase).path,'/__UsdMimicBase_1');assert.deepEqual(out.joints[1].drive,source.joints[1].drive);assert.equal(source.joints[1].drive.enabled,true);
});
test('scenes without mimic receive a detached snapshot without artificial articulations',()=>{
    const source=screwSnapshot();delete source.joints[1].mimic;
    const out=prepareUsdPhysicsSnapshot(source);assert.deepEqual(out,source);out.bodies[0].position[0]=3;assert.equal(source.bodies[0].position[0],0);
});

test('unlimited joints receive explicit infinite limits without imposing finite hard stops',()=>{
    const source=screwSnapshot();delete source.joints[0].limit;source.joints[1].limit.enabled=false;
    const out=prepareUsdPhysicsSnapshot(source);
    for(const j of out.joints.filter(j=>j.type!=='fixed'))assert.deepEqual(j.limit,{enabled:true,lower:-Infinity,upper:Infinity});
    assert.equal(source.joints[0].limit,undefined);assert.equal(source.joints[1].limit.enabled,false);
});

test('planned grounding preserves actual mechanism poses through multi-turn travel and reversed world endpoints',async()=>{
    const {createMechanism}=await import('../src/kinematics.js');
    for(const reversed of [false,true]){
        const source=screwSnapshot();
        if(reversed){const j=source.joints[0];j.body0=j.body1;delete j.body1;[j.position0,j.position1]=[j.position1,j.position0];[j.rotation0,j.rotation1]=[j.rotation1,j.rotation0];}
        const original=await createMechanism({snapshot:source});
        const planned=await createMechanism({snapshot:prepareUsdPhysicsSnapshot(source)});
        try{
            assert.deepEqual(planned.unsupported,[]);
            for(const target of [1200,4800,9600,0]){
                assert.equal(original.setJointValue('/Motor',target),true);
                assert.equal(planned.setJointValue('/Motor',target),true);
                for(const path of ['/Rotor','/Slide']){
                    const a=original.bodies.get(path),b=planned.bodies.get(path);
                    assert.ok(a.position.distanceTo(b.position)<1e-6);
                    assert.ok(a.rotation.angleTo(b.rotation)<1e-5);
                }
            }
        }finally{original.dispose();planned.dispose();}
    }
});
