// @ts-check
import {Plane, Raycaster, Vector2, Vector3} from 'three';

/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('three').Camera} Camera */
/** @typedef {{beginDrag(path:string, point:Vector3):boolean, moveDrag(point:Vector3):void, endDrag():void,
 * bodyForObject?:(object:Object3D,instanceIndex?:number)=>{data:{path:string}}|null|undefined}} PointerDragController */

/**
 * Bind a mechanism or simulation to a canvas. A movable surface captures the
 * pointer; stationary foreground surfaces and misses leave camera navigation alone.
 * The drag plane passes through the hit point and faces the camera at grab time.
 *
 * @template {PointerDragController} C
 * @param {{element:HTMLElement, camera:Camera|(()=>Camera|null|undefined),
 * controller:C|(()=>C|null|undefined), root?:Object3D|(()=>Object3D|null|undefined),
 * pick?:(event:PointerEvent,raycaster:Raycaster,controller:C)=>{path:string,point:Vector3}|null|undefined,
 * onDraggingChange?:(active:boolean)=>void,onMove?:()=>void}} options
 * `root` is the controller's local coordinate frame. Omit it for world-space
 * physics and supply a picker. Custom pickers always return world-space points.
 */
export function bindPointerDrag({element, camera, controller, root, pick, onDraggingChange, onMove}) {
    const ray = new Raycaster(), ndc = new Vector2(), plane = new Plane(), point = new Vector3();
    const doc = element.ownerDocument, win = doc.defaultView;
    const getController = () => typeof controller === 'function' ? controller() : controller;
    const getRoot = () => typeof root === 'function' ? root() : root;
    /** @type {{pointerId:number,controller:C,root:Object3D|null|undefined,cursor:string}|null} */
    let drag = null;

    /** @param {PointerEvent} event */
    function setRay(event) {
        const view = typeof camera === 'function' ? camera() : camera;
        const rect = element.getBoundingClientRect();
        if (!view || !rect.width || !rect.height) return null;
        ndc.set((event.clientX - rect.left) * 2 / rect.width - 1, 1 - (event.clientY - rect.top) * 2 / rect.height);
        view.updateWorldMatrix(true, false);
        ray.layers.mask = view.layers.mask;
        ray.setFromCamera(ndc, view);
        return view;
    }

    /** @param {Object3D|null|undefined} scene @param {C} target */
    function pickBody(scene, target) {
        if (!scene || !target.bodyForObject) return null;
        scene.updateWorldMatrix(true, true);
        for (const hit of ray.intersectObject(scene, true)) {
            let visible = true;
            for (let obj = /** @type {Object3D|null} */ (hit.object); obj; obj = obj.parent) {
                if (!obj.visible) { visible = false; break; }
            }
            if (!visible) continue;
            const body = target.bodyForObject(hit.object, hit.instanceId);
            // A visible unbound surface occludes parts behind it.
            return body ? {path:body.data.path, point:hit.point} : null;
        }
        return null;
    }

    /** @param {PointerEvent} event */
    function consume(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function cancel() {
        const previous = drag;
        if (!previous) return;
        drag = null;
        doc.removeEventListener('pointermove', move, true);
        doc.removeEventListener('pointerup', up, true);
        doc.removeEventListener('pointercancel', up, true);
        win?.removeEventListener('blur', cancel);
        try {
            if (element.hasPointerCapture(previous.pointerId)) element.releasePointerCapture(previous.pointerId);
            previous.controller.endDrag();
        } finally {
            element.style.cursor = previous.cursor;
            onDraggingChange?.(false);
        }
    }

    /** @param {PointerEvent} event */
    function down(event) {
        if (drag || event.button !== 0 || !event.isPrimary || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const target = getController();
        if (!target) return;
        const view = setRay(event);
        if (!view) return;
        const frame = getRoot();
        const hit = pick ? pick(event, ray, target) : pickBody(frame, target);
        if (!hit) return;
        point.copy(hit.point);
        if (frame) frame.worldToLocal(point);
        if (!target.beginDrag(hit.path, point)) return;
        drag = {pointerId:event.pointerId, controller:target, root:frame, cursor:element.style.cursor};
        plane.setFromNormalAndCoplanarPoint(view.getWorldDirection(point), hit.point);
        doc.addEventListener('pointermove', move, true);
        doc.addEventListener('pointerup', up, true);
        doc.addEventListener('pointercancel', up, true);
        win?.addEventListener('blur', cancel);
        consume(event);
        // A synthetic pointer or one released by the browser may be uncapturable.
        // Document listeners still complete the gesture in this window.
        try { element.setPointerCapture(event.pointerId); } catch {}
        element.style.cursor = 'grabbing';
        onDraggingChange?.(true);
    }

    /** @param {PointerEvent} event */
    function move(event) {
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (getController() !== drag.controller || getRoot() !== drag.root) { cancel(); return; }
        consume(event);
        if (!setRay(event) || !ray.ray.intersectPlane(plane, point)) return;
        if (drag.root) drag.root.worldToLocal(point);
        drag.controller.moveDrag(point);
        onMove?.();
    }

    /** @param {PointerEvent} event */
    function up(event) {
        if (drag?.pointerId !== event.pointerId) return;
        consume(event);
        cancel();
    }

    /** @param {PointerEvent} event */
    function lostCapture(event) { if (drag?.pointerId === event.pointerId) cancel(); }

    element.addEventListener('pointerdown', down, true);
    element.addEventListener('lostpointercapture', lostCapture);
    return {
        get dragging() { return !!drag; },
        cancel,
        dispose() {
            element.removeEventListener('pointerdown', down, true);
            element.removeEventListener('lostpointercapture', lostCapture);
            cancel();
        },
    };
}
