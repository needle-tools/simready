/** @param {import('@gltf-transform/core').PlatformIO} io */
export function registerSimreadyExtensions(io: import("@gltf-transform/core").PlatformIO): import("@gltf-transform/core").PlatformIO;
/** @param {import('@gltf-transform/core').Node} node */
export function hasPhysics(node: import("@gltf-transform/core").Node): boolean;
/** @param {import('@gltf-transform/core').GLTF.IGLTF} json */
export function hasSimreadyInput(json: import("@gltf-transform/core").GLTF.IGLTF): boolean;
/** @param {import('@gltf-transform/core').Document} document */
export function hasSimready(document: import("@gltf-transform/core").Document): boolean;
/** Collision-only nodes must stay serializable without becoming bake sources. */
/** @param {import('@gltf-transform/core').Document} document */
export function renderNodes(document: import("@gltf-transform/core").Document): import("@gltf-transform/core").Node[];
/** Snapshot collision geometry before visual optimization can replace it.
 * Detached nodes are referenced by the draft's geometry.node dialect; the
 * mesh dialect uses a direct graph edge. Both keep the authored collider.
 * Returns the scene's visual meshes for subsequent processing.
 * @param {import('@gltf-transform/core').Document} document */
export function retainCollisionGeometry(document: import("@gltf-transform/core").Document): Set<import("@gltf-transform/core").Mesh>;
/** @param {import('@gltf-transform/core').Property} property */
export function physicsOwns(property: import("@gltf-transform/core").Property): boolean;
/** Graph-owned resources whose coordinates or identity carry simulation meaning.
 * @param {import('@gltf-transform/core').Document} document
 */
export function simulationResources(document: import("@gltf-transform/core").Document): {
    collisionMeshes: Set<import("@gltf-transform/core").Mesh>;
    simulationNodes: Set<import("@gltf-transform/core").Node>;
};
export const PHYSICS_BODIES: "KHR_physics_rigid_bodies";
export const IMPLICIT_SHAPES: "KHR_implicit_shapes";
/** @typedef {import('@gltf-transform/core').IProperty & {
 * payload: Record<string, any>, references: import('@gltf-transform/core').RefMap<import('@gltf-transform/core').Node | import('@gltf-transform/core').Mesh>, hullData: PhysicsHullData,
 * }} IPhysicsData */
/** Index-bearing fields are graph edges, so cloning and reordering cannot
 * leave physics pointing at a different render node or collision mesh.
 * @extends {ExtensionProperty<IPhysicsData>}
 */
export class PhysicsData extends ExtensionProperty<IPhysicsData> {
    constructor(graph: import("property-graph").Graph<import("@gltf-transform/core").Property>, name?: string);
    extensionName: string;
    propertyType: string;
    parentTypes: PropertyType[];
    getPayload(): Record<string, any>;
    /** @param {Record<string, any>} value */
    setPayload(value: Record<string, any>): this;
    /** @param {string} path @param {import('@gltf-transform/core').Node | import('@gltf-transform/core').Mesh} value */
    setReference(path: string, value: import("@gltf-transform/core").Node | import("@gltf-transform/core").Mesh): this;
    /** @param {string} path */
    getReference(path: string): import("@gltf-transform/core").Node | import("@gltf-transform/core").Mesh | null;
    referencePaths(): string[];
    getHullBytes(): Uint8Array<ArrayBufferLike> | null;
    /** @param {PhysicsHullData} data */
    setHullData(data: PhysicsHullData): this;
}
/** @extends {ExtensionProperty<import('@gltf-transform/core').IProperty & {payload: Record<string, any>}>} */
export class ShapeData extends ExtensionProperty<import("@gltf-transform/core").IProperty & {
    payload: Record<string, any>;
}> {
    constructor(graph: import("property-graph").Graph<import("@gltf-transform/core").Property>, name?: string);
    extensionName: string;
    propertyType: string;
    parentTypes: PropertyType[];
    getDefaults(): {
        payload: {};
        name: string | null;
        extras: Record<string, unknown> | null;
    };
    getPayload(): Record<string, any>;
    /** @param {Record<string, any>} payload */
    setPayload(payload: Record<string, any>): this;
}
export class ImplicitShapesExtension extends Extension {
    extensionName: string;
    /** @param {import('@gltf-transform/core').ReaderContext} context */
    read(context: import("@gltf-transform/core").ReaderContext): this;
    /** @param {import('@gltf-transform/core').WriterContext} context */
    write(context: import("@gltf-transform/core").WriterContext): this;
}
export class PhysicsBodiesExtension extends Extension {
    extensionName: string;
    prewriteTypes: PropertyType[];
    /** @param {import('@gltf-transform/core').ReaderContext} context */
    read(context: import("@gltf-transform/core").ReaderContext): this;
    /** @param {import('@gltf-transform/core').WriterContext} context */
    prewrite(context: import("@gltf-transform/core").WriterContext): this;
    /** @param {import('@gltf-transform/core').WriterContext} context */
    write(context: import("@gltf-transform/core").WriterContext): this;
}
export const simulationExtensions: readonly string[];
export const SIMREADY_EXTENSIONS: (typeof NeedleSimreadyExtension)[];
export type IPhysicsData = import("@gltf-transform/core").IProperty & {
    payload: Record<string, any>;
    references: import("@gltf-transform/core").RefMap<import("@gltf-transform/core").Node | import("@gltf-transform/core").Mesh>;
    hullData: PhysicsHullData;
};
import { ExtensionProperty } from '@gltf-transform/core';
import { PropertyType } from '@gltf-transform/core';
/** One graph-owned blob per input buffer view: several bodies can point into
 * one shared hull stream, including after preview cloning.
 * @extends {ExtensionProperty<import('@gltf-transform/core').IProperty & {bytes: Uint8Array, buffer: import('@gltf-transform/core').Buffer}>} */
declare class PhysicsHullData extends ExtensionProperty<import("@gltf-transform/core").IProperty & {
    bytes: Uint8Array;
    buffer: import("@gltf-transform/core").Buffer;
}> {
    constructor(graph: import("property-graph").Graph<import("@gltf-transform/core").Property>, name?: string);
    extensionName: string;
    propertyType: string;
    parentTypes: string[];
    getDefaults(): {
        bytes: Uint8Array<ArrayBuffer>;
        buffer: null;
        name: string | null;
        extras: Record<string, unknown> | null;
    };
    getBytes(): Uint8Array<ArrayBufferLike>;
    /** @param {Uint8Array} bytes @param {import('@gltf-transform/core').Buffer} buffer */
    setBytes(bytes: Uint8Array, buffer: import("@gltf-transform/core").Buffer): this;
}
import { Extension } from '@gltf-transform/core';
import { NeedleSimreadyExtension } from './runtime-extension.js';
import { SimreadyData } from './runtime-extension.js';
import { NEEDLE_SIMREADY } from './runtime-extension.js';
export { NeedleSimreadyExtension, SimreadyData, NEEDLE_SIMREADY };
