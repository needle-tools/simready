import assert from 'node:assert/strict';
import {test} from 'node:test';
import {BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3} from 'three';
import {bindPointerDrag} from '../src/three.js';

test('accepts the nearest bound instance, projects in root space, and releases gesture ownership', () => {
    const canvas = new EventTarget(), doc = new EventTarget(), win = new EventTarget();
    let captured = null;
    Object.assign(canvas, {ownerDocument:doc, style:{cursor:'crosshair'},
        getBoundingClientRect:()=>({left:10,top:20,width:400,height:400}),
        setPointerCapture:id=>{ captured=id; }, releasePointerCapture:()=>{ captured=null; }, hasPointerCapture:id=>id===captured});
    doc.defaultView=win;
    const camera = new PerspectiveCamera(45,1,.1,100);
    camera.position.set(1,0,8); camera.lookAt(1,0,0);
    const root = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    root.position.x=1; root.scale.setScalar(2);
    const instances = new InstancedMesh(geometry,material,2), blocker = new Mesh(geometry,material);
    instances.setMatrixAt(0,new Matrix4().makeTranslation(5,0,0));
    instances.setMatrixAt(1,new Matrix4());
    blocker.position.z=1;
    root.add(instances,blocker);
    const events=[], positions=[];
    let activeController;
    const controller={bodyForObject(object,index){return object===instances && index===1 ? {data:{path:'/Tip'}} : null;},
        beginDrag(path,p){events.push(path);positions.push(p.clone());return true;},
        moveDrag(p){positions.push(p.clone());}, endDrag(){events.push('end');}};
    activeController=controller;
    const binding=bindPointerDrag({element:canvas,camera,controller:()=>activeController,root,
        onDraggingChange:value=>events.push(value)});
    function fire(target,type,id=1,clientX=210,extra={}) {
        const e=Object.assign(new Event(type,{cancelable:true}),{pointerId:id,isPrimary:true,button:0,clientX,clientY:220},extra);
        target.dispatchEvent(e);return e.defaultPrevented;
    }
    assert.equal(fire(canvas,'pointerdown'),false); // opaque unbound part
    blocker.visible=false;
    assert.equal(fire(canvas,'pointerdown',1,210,{altKey:true}),false);
    assert.equal(fire(canvas,'pointerdown',1,12),false); // empty space
    assert.equal(fire(canvas,'pointerdown'),true);
    assert.ok(positions[0].distanceTo(new Vector3(0,0,.5))<1e-6);
    assert.equal(binding.dragging,true); assert.equal(captured,1);
    assert.equal(fire(doc,'pointermove',2,240),false);
    assert.equal(fire(doc,'pointermove',1,240),true);
    assert.ok(positions[1].x>0 && Math.abs(positions[1].z-.5)<1e-6);
    fire(doc,'pointercancel');assert.equal(canvas.style.cursor,'crosshair');
    assert.equal(binding.dragging,false);assert.equal(captured,null);
    fire(canvas,'pointerdown');activeController=null;fire(doc,'pointermove'); // replaced controller
    assert.equal(binding.dragging,false);
    activeController=controller;
    fire(canvas,'pointerdown');win.dispatchEvent(new Event('blur'));
    fire(canvas,'pointerdown');binding.dispose();binding.dispose();
    assert.equal(fire(canvas,'pointerdown'),false);
    assert.deepEqual(events,Array(4).fill(['/Tip',true,'end',false]).flat());
    geometry.dispose();material.dispose();instances.dispose();
});
