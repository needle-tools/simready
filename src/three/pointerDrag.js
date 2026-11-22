// @ts-check
import {Plane, Raycaster, Vector2, Vector3} from 'three';

/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('three').Camera} Camera */
/** @typedef {{beginDrag(path:string, point:Vector3, options?:{normal?:Vector3}):boolean, moveDrag(point:Vector3):void, endDrag():void,
 * canDrag?:(path:string)=>boolean,
 * bodyForObject?:(object:Object3D,instanceIndex?:number)=>{data:{path:string}}|null|undefined}} PointerDragController */

/**
 * Bind a mechanism or simulation to a canvas. A movable surface captures the
 * pointer; stationary foreground surfaces and misses leave camera navigation alone.
 * The drag plane passes through the hit point and faces the camera at grab time.
 * The binding never styles the element: hosts set cursors from `onHoverChange`
 * (the draggable part under an idle pointer, or null) and `onDraggingChange`.
 *
 * @template {PointerDragController} C
 * @param {{element:HTMLElement, camera:Camera|(()=>Camera|null|undefined),
 * controller:C|(()=>C|null|undefined), root?:Object3D|(()=>Object3D|null|undefined),
 * pick?:(event:PointerEvent,raycaster:Raycaster,controller:C)=>{path:string,point:Vector3}|null|undefined,
 * onDraggingChange?:(active:boolean)=>void,onHoverChange?:(path:string|null)=>void,onMove?:()=>void}} options
 * `root` is the controller's local coordinate frame. Omit it for world-space
 * physics and supply a picker. Custom pickers always return world-space points.
 */
export function bindPointerDrag({element, camera, controller, root, pick, onDraggingChange, onHoverChange, onMove}) {
    const ray = new Raycaster(), ndc = new Vector2(), plane = new Plane(), point = new Vector3();
    const doc = element.ownerDocument, win = doc.defaultView;
    const capture = {capture: true};
    const getController = () => typeof controller === 'function' ? controller() : controller;
    const getRoot = () => typeof root === 'function' ? root() : root;
    /** @type {{pointerId:number,controller:C,root:Object3D|null|undefined}|null} */
    let drag = null;
    /** @type {string|null} */
    let hovered = null;
    let disposed = false;
    /** @type {PointerEvent|null} */
    let pendingHover = null;
    let hoverFrame = 0;

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

    /** The body under the pointer and its world-space hit, before any controller decision.
     * @param {PointerEvent} event @param {C} target */
    function hitAt(event, target) {
        const view = setRay(event);
        if (!view) return null;
        const frame = getRoot();
        const hit = pick ? pick(event, ray, target) : pickBody(frame, target);
        return hit ? {hit, view, frame} : null;
    }

    /** @param {string|null} path */
    function setHovered(path) {
        if (path === hovered) return;
        hovered = path;
        onHoverChange?.(path);
    }

    /** Report the draggable part under an idle pointer. A pressed button belongs to
     * camera navigation, so nothing is offered while it is held.
     * @param {PointerEvent} event */
    function hover(event) {
        if (drag || disposed || !onHoverChange) return;
        const target = getController();
        if (!target || event.buttons) { setHovered(null); return; }
        const found = hitAt(event, target);
        const path = found && (target.canDrag ? target.canDrag(found.hit.path) : true) ? found.hit.path : null;
        setHovered(path);
    }

    /** Raycasting a large scene on every pointer move is costly; evaluate the
     * latest position once per frame where frames are available.
     * @param {PointerEvent} event */
    function scheduleHover(event) {
        if (drag || disposed || !onHoverChange) return;
        if (!win?.requestAnimationFrame) { hover(event); return; }
        pendingHover = event;
        if (!hoverFrame) hoverFrame = win.requestAnimationFrame(() => {
            hoverFrame = 0;
            const latest = pendingHover;
            pendingHover = null;
            if (latest) hover(latest);
        });
    }

    function dropPendingHover() {
        pendingHover = null;
        if (hoverFrame) win?.cancelAnimationFrame?.(hoverFrame);
        hoverFrame = 0;
    }

    function leave() { dropPendingHover(); if (!drag) setHovered(null); }

    /** @param {PointerEvent} event */
    function consume(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    /** End the gesture; returns whether one was active. */
    function finish() {
        const previous = drag;
        if (!previous) return false;
        drag = null;
        doc.removeEventListener('pointermove', move, capture);
        doc.removeEventListener('pointerup', up, capture);
        doc.removeEventListener('pointercancel', up, capture);
        win?.removeEventListener('blur', cancel);
        try {
            if (element.hasPointerCapture(previous.pointerId)) element.releasePointerCapture(previous.pointerId);
            previous.controller.endDrag();
        } finally {
            onDraggingChange?.(false);
        }
        return true;
    }

    /** An interrupted gesture has no reliable pointer position, so nothing is hovered. */
    function cancel() { if (finish()) setHovered(null); }

    /** @param {PointerEvent} event */
    function down(event) {
        if (drag || event.button !== 0 || !event.isPrimary || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const target = getController();
        if (!target) return;
        const found = hitAt(event, target);
        if (!found) return;
        const {hit, view, frame} = found;
        point.copy(hit.point);
        if (frame) frame.worldToLocal(point);
        // The drag plane's normal, in the controller's frame, tells a hinge how it is seen.
        const normal = view.getWorldDirection(new Vector3());
        if (frame) normal.transformDirection(frame.matrixWorld.clone().invert());
        if (!target.beginDrag(hit.path, point, {normal})) return;
        drag = {pointerId:event.pointerId, controller:target, root:frame};
        dropPendingHover();
        setHovered(hit.path);
        plane.setFromNormalAndCoplanarPoint(view.getWorldDirection(point), hit.point);
        doc.addEventListener('pointermove', move, capture);
        doc.addEventListener('pointerup', up, capture);
        doc.addEventListener('pointercancel', up, capture);
        win?.addEventListener('blur', cancel);
        consume(event);
        // A synthetic pointer or one released by the browser may be uncapturable.
        // Document listeners still complete the gesture in this window.
        try { element.setPointerCapture(event.pointerId); } catch {}
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
        finish();
        // The release point may be over a different part, or none.
        hover(event);
    }

    /** @param {PointerEvent} event */
    function lostCapture(event) { if (drag?.pointerId === event.pointerId) cancel(); }

    element.addEventListener('pointerdown', down, capture);
    element.addEventListener('lostpointercapture', lostCapture);
    element.addEventListener('pointermove', scheduleHover);
    element.addEventListener('pointerleave', leave);
    return {
        get dragging() { return !!drag; },
        get hovered() { return hovered; },
        cancel,
        dispose() {
            if (disposed) return;
            element.removeEventListener('pointerdown', down, capture);
            element.removeEventListener('lostpointercapture', lostCapture);
            element.removeEventListener('pointermove', scheduleHover);
            element.removeEventListener('pointerleave', leave);
            dropPendingHover();
            cancel();
            setHovered(null);
            disposed = true;
        },
    };
}
