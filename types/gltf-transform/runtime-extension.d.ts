export const NEEDLE_SIMREADY: "NEEDLE_simready";
/** @typedef {import('@gltf-transform/core').IProperty & {payload:Record<string,any>, references:import('@gltf-transform/core').RefMap<import('@gltf-transform/core').Node>,meshes:import('@gltf-transform/core').RefMap<import('@gltf-transform/core').Mesh>}} SimreadyProperties */
/** @extends {ExtensionProperty<SimreadyProperties>} */
export class SimreadyData extends ExtensionProperty<SimreadyProperties> {
    constructor(graph: import("property-graph").Graph<import("@gltf-transform/core").Property>, name?: string);
    extensionName: string;
    propertyType: string;
    parentTypes: PropertyType[];
    getPayload(): Record<string, any>;
    /** @param {Record<string,any>} value */
    setPayload(value: Record<string, any>): this;
    /** @param {string} key @param {import('@gltf-transform/core').Node} node */
    setReference(key: string, node: import("@gltf-transform/core").Node): this;
    /** @param {string} key */
    getReference(key: string): import("@gltf-transform/core").Node | null;
    referencePaths(): string[];
    /** @param {string} key @param {import('@gltf-transform/core').Mesh} mesh */
    setMesh(key: string, mesh: import("@gltf-transform/core").Mesh): this;
    /** @param {string} key */
    getMesh(key: string): import("@gltf-transform/core").Mesh | null;
    meshPaths(): string[];
}
export class NeedleSimreadyExtension extends Extension {
    extensionName: string;
    /** @param {import('@gltf-transform/core').ReaderContext} context */
    read(context: import("@gltf-transform/core").ReaderContext): this;
    /** @param {import('@gltf-transform/core').WriterContext} context */
    write(context: import("@gltf-transform/core").WriterContext): this;
}
export type SimreadyProperties = import("@gltf-transform/core").IProperty & {
    payload: Record<string, any>;
    references: import("@gltf-transform/core").RefMap<import("@gltf-transform/core").Node>;
    meshes: import("@gltf-transform/core").RefMap<import("@gltf-transform/core").Mesh>;
};
import { ExtensionProperty } from '@gltf-transform/core';
import { PropertyType } from '@gltf-transform/core';
import { Extension } from '@gltf-transform/core';
