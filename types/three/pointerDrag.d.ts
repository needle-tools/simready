/** @typedef {import('three').Object3D} Object3D */
/** @typedef {import('three').Camera} Camera */
/** @typedef {{beginDrag(path:string, point:Vector3, options?:{normal?:Vector3}):boolean, moveDrag(point:Vector3):void, endDrag():void,
 * canDrag?:(path:string)=>boolean,
 * bodyForObject?:(object:Object3D,instanceIndex?:number)=>{data:{path:string}}|null|undefined}} PointerDragController */
/**
 * Bind a mechanism or simulation to a canvas. A movable surface captures the
 * pointer; stationary foreground surfaces and misses leave camera navigation alone.
 * Press and release still reach the host, so its click and double-click handling
 * (such as focusing the camera) keeps working on movable parts. Pointer moves of an
 * active drag are consumed, so navigation that started on the press does not move.
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
export function bindPointerDrag<C extends PointerDragController>({ element, camera, controller, root, pick, onDraggingChange, onHoverChange, onMove }: {
    element: HTMLElement;
    camera: Camera | (() => Camera | null | undefined);
    controller: C | (() => C | null | undefined);
    root?: Object3D | (() => Object3D | null | undefined);
    pick?: (event: PointerEvent, raycaster: Raycaster, controller: C) => {
        path: string;
        point: Vector3;
    } | null | undefined;
    onDraggingChange?: (active: boolean) => void;
    onHoverChange?: (path: string | null) => void;
    onMove?: () => void;
}): {
    readonly dragging: boolean;
    readonly hovered: string | null;
    cancel: () => void;
    dispose(): void;
};
export type Object3D = import("three").Object3D;
export type Camera = import("three").Camera;
export type PointerDragController = {
    beginDrag(path: string, point: Vector3, options?: {
        normal?: Vector3;
    }): boolean;
    moveDrag(point: Vector3): void;
    endDrag(): void;
    canDrag?: (path: string) => boolean;
    bodyForObject?: (object: Object3D, instanceIndex?: number) => {
        data: {
            path: string;
        };
    } | null | undefined;
};
import { Raycaster } from 'three';
import { Vector3 } from 'three';
