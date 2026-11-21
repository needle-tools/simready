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

function hoverScene() {
    const canvas = new EventTarget(), doc = new EventTarget(), win = new EventTarget();
    let captured = null;
    Object.assign(canvas, {ownerDocument:doc, style:{cursor:'crosshair'},
        getBoundingClientRect:()=>({left:0,top:0,width:400,height:400}),
        setPointerCapture:id=>{ captured=id; }, releasePointerCapture:()=>{ captured=null; }, hasPointerCapture:id=>id===captured});
    doc.defaultView = win;
    const camera = new PerspectiveCamera(45,1,.1,100);
    camera.position.set(0,0,8); camera.lookAt(0,0,0);
    const root = new Group(), geometry = new BoxGeometry(), material = new MeshBasicMaterial();
    const lever = new Mesh(geometry,material), base = new Mesh(geometry,material);
    lever.position.x = -1.5; base.position.x = 1.5;
    root.add(lever,base);
    const movable = new Set(['/Lever']);
    const controller = {
        bodyForObject(object){ return object===lever ? {data:{path:'/Lever'}} : object===base ? {data:{path:'/Base'}} : null; },
        canDrag(path){ return movable.has(path); },
        beginDrag(){ return true; }, moveDrag(){}, endDrag(){},
    };
    const hovered = [];
    const binding = bindPointerDrag({element:canvas,camera,controller,root,onHoverChange:path=>hovered.push(path)});
    function fire(target,type,clientX,extra={}) {
        const e = Object.assign(new Event(type,{cancelable:true}),{pointerId:1,isPrimary:true,button:0,buttons:0,clientX,clientY:200},extra);
        target.dispatchEvent(e); return e;
    }
    // Screen x for a world x on the z=0 plane.
    const screenX = x => 200 + new Vector3(x,0,0).project(camera).x * 200;
    return {canvas, doc, win, camera, root, controller, binding, hovered, fire, screenX, movable, lever, dispose(){ binding.dispose(); geometry.dispose(); material.dispose(); }};
}

test('reports hover changes only for parts the controller can drag, without styling the element', () => {
    const scene = hoverScene(), {canvas, doc, hovered, fire, screenX} = scene;
    try {
        fire(canvas,'pointermove',screenX(-1.5));
        fire(canvas,'pointermove',screenX(-1.4)); // same part: no repeat
        fire(canvas,'pointermove',screenX(1.5));  // bound but not draggable
        fire(canvas,'pointermove',5);             // empty space
        fire(canvas,'pointermove',screenX(-1.5));
        fire(canvas,'pointerleave',-10);
        assert.deepEqual(hovered,['/Lever',null,'/Lever',null]);
        fire(canvas,'pointermove',screenX(-1.5));
        fire(canvas,'pointermove',screenX(1.5),{buttons:1}); // camera navigation in progress
        assert.deepEqual(hovered.slice(4),['/Lever',null]);

        fire(canvas,'pointermove',screenX(-1.5));
        fire(canvas,'pointerdown',screenX(-1.5),{buttons:1});
        assert.equal(scene.binding.dragging,true);
        fire(doc,'pointermove',screenX(1.5),{buttons:1}); // dragging: hover is frozen on the grabbed part
        assert.deepEqual(hovered.slice(6),['/Lever']);
        fire(doc,'pointerup',screenX(1.5));               // released over a stationary part
        assert.deepEqual(hovered.slice(6),['/Lever',null]);
        assert.equal(canvas.style.cursor,'crosshair','the host owns cursor styling');
    } finally { scene.dispose(); }
});

test('re-evaluates hover when draggability changes and clears it on dispose', () => {
    const scene = hoverScene(), {canvas, hovered, fire, screenX, movable} = scene;
    fire(canvas,'pointermove',screenX(-1.5));
    movable.delete('/Lever');
    fire(canvas,'pointermove',screenX(-1.45));
    assert.deepEqual(hovered,['/Lever',null]);
    movable.add('/Lever');
    fire(canvas,'pointermove',screenX(-1.5));
    scene.dispose();
    assert.deepEqual(hovered,['/Lever',null,'/Lever',null]);
    fire(canvas,'pointermove',screenX(-1.5));
    assert.equal(hovered.length,4,'disposed bindings stop reporting');
});

test('ignores hidden surfaces when reporting hover', () => {
    const scene = hoverScene(), {canvas, hovered, fire, screenX, lever} = scene;
    try {
        lever.visible = false;
        fire(canvas,'pointermove',screenX(-1.5));
        assert.deepEqual(hovered,[]);
        lever.visible = true;
        fire(canvas,'pointermove',screenX(-1.45));
        assert.deepEqual(hovered,['/Lever']);
    } finally { scene.dispose(); }
});

test('clears hover when a drag is interrupted rather than released', () => {
    const scene = hoverScene(), {canvas, win, hovered, fire, screenX} = scene;
    try {
        fire(canvas,'pointermove',screenX(-1.5));
        fire(canvas,'pointerdown',screenX(-1.5),{buttons:1});
        win.dispatchEvent(new Event('blur'));
        assert.equal(scene.binding.dragging,false);
        assert.deepEqual(hovered,['/Lever',null]);
    } finally { scene.dispose(); }
});

test('evaluates hover at most once per animation frame, using the latest pointer position', () => {
    const scene = hoverScene(), {canvas, win, hovered, fire, screenX} = scene;
    scene.binding.dispose();
    const frames = [];
    win.requestAnimationFrame = callback => frames.push(callback);
    win.cancelAnimationFrame = () => {};
    const reported = [];
    const binding = bindPointerDrag({element:canvas,camera:scene.camera,controller:scene.controller,root:scene.root,onHoverChange:path=>reported.push(path)});
    try {
        fire(canvas,'pointermove',screenX(1.5));
        fire(canvas,'pointermove',screenX(-1.5));
        assert.equal(frames.length,1,'one frame requested for a burst of moves');
        assert.deepEqual(reported,[]);
        frames.shift()();
        assert.deepEqual(reported,['/Lever'],'only the latest position is evaluated');
        fire(canvas,'pointermove',screenX(1.5));
        binding.dispose();
        frames.shift()?.();
        assert.deepEqual(reported,['/Lever',null],'a pending evaluation does not run after dispose');
    } finally { binding.dispose(); }
    assert.deepEqual(hovered,[]);
});
