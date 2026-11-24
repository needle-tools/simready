import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Matrix4,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createSimreadyExtension} from '../src/index.js';
import {registerSimreadyLoader,toGltfPhysicsSnapshot} from '../src/gltf.js';
import {createMechanism} from '../src/kinematics.js';

const identity=[0,0,0,1], zero=[0,0,0];
const body=(path,position=zero)=>({path,position,rotation:identity});
function joint(path,type,body0,body1,position0=zero,position1=zero,axis='X') {
    return {path,type,body0,body1,axis,position0,position1,rotation0:identity,rotation1:identity};
}
function table(scale=1,reversed=false) {
    const u=1/scale;
    const x=joint('/X','prismatic','','/Carriage',[2*u,0,0]);
    const y=joint('/Y','prismatic','/Carriage','/Slide',zero,zero,'Y');
    for(const edge of [x,y]) {
        if(reversed){
            [edge.body0,edge.body1]=[edge.body1,edge.body0];
            [edge.position0,edge.position1]=[edge.position1,edge.position0];
        }
        edge.limit={enabled:true,lower:reversed?-.5*u:0,upper:reversed?0:.5*u};
    }
    return {metersPerUnit:scale,kilogramsPerUnit:1,upAxis:'Y',scenes:[],materials:[],groups:[],shapes:[],
        bodies:[body('/Carriage',[2*u,0,0]),body('/Slide',[2*u,0,0]),body('/Tip',[2*u,0,u])],
        joints:[x,y,joint('/Mount','fixed','/Slide','/Tip',[0,0,u])]};
}
const close=(a,b,epsilon=1e-3)=>assert.ok(Math.abs(a-b)<epsilon,`expected ${a} close to ${b}`);
function sweep(mechanism,from,to) {
    for(let i=1;i<=20;i++)mechanism.moveDrag(from.clone().lerp(to,i/20));
}

for(const [scale,reversed] of [[1,false],[.001,true]]) {
    test(`point mode reaches a picked fixed tool in ${scale} m units, reversed ${reversed}`,async()=>{
        const snapshot=table(scale,reversed);
        const m=await createMechanism({snapshot,dragMode:'point'});
        try {
            assert.deepEqual(m.unsupported,[]);
            const unit=1/scale, sign=reversed?-1:1;
            const point=new Vector3(2.04,.02,1.1).multiplyScalar(unit);
            const target=point.clone().addScaledVector(new Vector3(.3,.4,0),unit);
            assert.equal(m.beginDrag('/Tip',point),false);
            m.play();
            assert.equal(m.beginDrag('/Tip',point),true);
            sweep(m,point,target);
            close(m.getJointValue('/X')*scale,.3*sign);
            close(m.getJointValue('/Y')*scale,.4*sign);
            const tip=m.bodies.get('/Tip').body.translation();
            close(tip.x*scale,2.3);close(tip.y*scale,.4);close(tip.z*scale,1);
            sweep(m,target,target.clone().addScaledVector(new Vector3(1,.5,0),unit));
            close(m.getJointValue('/X')*scale,.5*sign);
            close(m.getJointValue('/Y')*scale,.5*sign);
            m.endDrag();m.moveDrag(point);
            close(m.getJointValue('/X')*scale,.5*sign);
            m.reset();close(m.getJointValue('/X'),0);close(m.getJointValue('/Y'),0);
        }finally{m.dispose();}
    });
}

test('a light wrist settles smoothly when the pointer pulls a robot arm beyond reach', async () => {
    const lengths = [.4, .4, .1], masses = [2, 1, .05];
    const bodies = [body('/Base'), body('/Elbow', [.4, 0, 0]), body('/Wrist', [.8, 0, 0])];
    const joints = bodies.map(({path}, i) => ({
        ...joint(path + 'Hinge', 'revolute', bodies[i - 1]?.path ?? '', path,
            i ? [lengths[i - 1], 0, 0] : zero, zero, 'Z'),
        limit: {enabled:true, lower:-90, upper:90},
    }));
    const shapes = bodies.map(({path}, i) => ({
        path:path + 'Shape', body:path, type:'cube', rotation:identity,
        position:[lengths[i] / 2, 0, 0], halfExtents:[lengths[i] / 2, .025, .025], mass:masses[i],
    }));
    const snapshot = {...table(), bodies, joints, shapes};
    const m = await createMechanism({snapshot, dragMode:'point'});
    try {
        m.play();
        assert.ok(m.setJointValue('/ElbowHinge', 3));
        const wrist = m.bodies.get('/Wrist');
        const contact = () => new Vector3(.1, .02, 0).applyMatrix4(new Matrix4().fromArray(wrist.link.matrixWorld));
        const start = contact(), outside = start.clone().add(new Vector3(0, 1.2, 0));
        assert.ok(m.beginDrag('/Wrist', start));
        const angles = () => joints.map(({path}) => m.getJointValue(path));
        let previous = angles(), settled;
        for (let i = 1; i <= 100; i++) {
            const pointer = start.clone().lerp(outside, Math.min(i / 60, 1));
            const distance = contact().distanceTo(pointer);
            m.moveDrag(pointer);
            assert.ok(contact().distanceTo(pointer) <= distance + 1e-5, 'the grabbed point moves toward the pointer');
            const next = angles();
            next.forEach((angle, index) => assert.ok(Math.abs(angle - previous[index]) < 8, 'joint visibly snapped'));
            if (i === 80) settled = next;
            previous = next;
        }
        assert.ok(contact().distanceTo(outside) < .8, 'the arm keeps reaching toward a distant pointer');
        previous.forEach((angle, index) => close(angle, settled[index], .5));
        sweep(m, outside, start);
        assert.ok(contact().distanceTo(start) < .002, 'the arm follows when the pointer returns within reach');
    } finally {
        m.dispose();
    }
});

test('default drag still poses the nearest joint on a serial mechanism',async()=>{
    const m=await createMechanism({snapshot:table()});
    try {
        m.play();const p=new Vector3(2,0,1);
        assert.equal(m.beginDrag('/Tip',p),true);
        m.moveDrag(new Vector3(2.3,.4,1));
        close(m.getJointValue('/X'),0);close(m.getJointValue('/Y'),.4);
    }finally{m.dispose();}
});

test('a serial mimic follows its authored actuator in point mode',async()=>{
    const snapshot=table();
    snapshot.joints[1].mimic={joint:'/X',multiplier:2,offset:0};
    const m=await createMechanism({snapshot,dragMode:'point'});
    try {
        m.play();
        assert.equal(m.beginDrag('/Tip',new Vector3(2,0,1)),true);
        m.moveDrag(new Vector3(2.45,.4,1));
        close(m.getJointValue('/X'),.2);close(m.getJointValue('/Y'),.4);
    }finally{m.dispose();}
});

test('glTF point dragging follows a picked location offset from a hinged tool body',async()=>{
    const snapshot=table();
    snapshot.joints[1]=joint('/Yaw','revolute','/Carriage','/Slide',zero,zero,'Z');
    const extension=createSimreadyExtension({snapshot:toGltfPhysicsSnapshot(snapshot),stageNode:0,
        bindings:[{node:1,path:'/Tip'}]});
    const asset={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],
        nodes:[{children:[1]},{translation:[2,0,1]}],extensionsUsed:['NEEDLE_simready'],
        extensions:{NEEDLE_simready:extension}};
    const gltf=await registerSimreadyLoader(new GLTFLoader()).parseAsync(JSON.stringify(asset),'');
    const runtime=gltf.userData.simready,m=await runtime.createMechanism({dragMode:'point'});
    try {
        m.play();
        const offset=new Vector3(.5,0,0), picked=new Vector3(2.5,0,1);
        const target=new Vector3(2.2+.5*Math.cos(Math.PI/6),.25,1);
        assert.equal(m.beginDrag('/Tip',picked),true);
        sweep(m,picked,target);
        const actual=runtime.bindings[0].object.localToWorld(offset.clone());
        assert.ok(actual.distanceTo(target)<.001,`reached ${actual.toArray()}, target ${target.toArray()}`);
        close(m.getJointValue('/Yaw'),30,.1);close(m.getJointValue('/X'),.2);
        m.pause();m.moveDrag(picked);close(m.getJointValue('/Yaw'),30,.1);
    }finally{m.dispose();}
});

test('a closed assembly retains its actuator, while another world-attached tool can reach in two axes',async()=>{
    const snapshot=table();
    snapshot.joints.push(joint('/Guide','prismatic','/Carriage','/Slide',zero,zero,'Y'));
    snapshot.bodies.push(body('/OtherBase'),body('/OtherEnd'));
    snapshot.joints.push(joint('/OtherX','prismatic','','/OtherBase'),
        joint('/OtherY','prismatic','/OtherBase','/OtherEnd',zero,zero,'Y'));
    const m=await createMechanism({snapshot,dragMode:'point'});
    try {
        m.play();
        assert.equal(m.joints.get('/Guide').closure,true);
        const start=new Vector3(2,0,1);
        assert.equal(m.beginDrag('/Tip',start),true);
        sweep(m,start,new Vector3(2.2,.3,1));
        close(m.getJointValue('/X'),0);close(m.getJointValue('/Y'),.3);
        close(m.getJointValue('/Guide'),.3);
        assert.equal(m.beginDrag('/OtherEnd',new Vector3()),true);
        sweep(m,new Vector3(),new Vector3(.2,.25,0));
        close(m.getJointValue('/OtherX'),.2);close(m.getJointValue('/OtherY'),.25);
        close(m.getJointValue('/Guide'),.3);
    }finally{m.dispose();}
});

test('a spherical tool on a serial slide keeps its authored swing limit in point mode',async()=>{
    const snapshot=table();
    const ball=snapshot.joints[2];
    ball.type='spherical';
    ball.limit={enabled:true,lower:20,upper:30};
    const m=await createMechanism({snapshot,dragMode:'point'});
    try {
        m.play();
        assert.equal(m.beginDrag('/Tip',new Vector3(2.5,0,1)),true);
        m.moveDrag(new Vector3(2,.5,1));
        const body=m.bodies.get('/Tip');
        const direction=new Vector3(1,0,0).applyQuaternion(body.rotation);
        close(Math.acos(direction.x)*180/Math.PI,20);
        close(m.getJointValue('/X'),0);close(m.getJointValue('/Y'),0);
        assert.ok(m.adaptations.some(a=>a.target==='circular cone limit'));
    }finally{m.dispose();}
});
