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
export function bindPointerDrag<C extends PointerDragController>({ element, camera, controller, root, pick, onDraggingChange, onMove }: {
    element: HTMLElement;
    camera: Camera | (() => Camera | null | undefined);
    controller: C | (() => C | null | undefined);
    root?: Object3D | (() => Object3D | null | undefined);
    pick?: (event: PointerEvent, raycaster: Raycaster, controller: C) => {
        path: string;
        point: Vector3;
    } | null | undefined;
    onDraggingChange?: (active: boolean) => void;
    onMove?: () => void;
}): {
    readonly dragging: boolean;
    cancel: () => void;
    dispose(): void;
};
export type Object3D = import("three").Object3D;
export type Camera = import("three").Camera;
export type PointerDragController = {
    beginDrag(path: string, point: Vector3): boolean;
    moveDrag(point: Vector3): void;
    endDrag(): void;
    bodyForObject?: (object: Object3D, instanceIndex?: number) => {
        data: {
            path: string;
        };
    } | null | undefined;
};
import { Raycaster } from 'three';
import { Vector3 } from 'three';
