/** @param {unknown} value @returns {value is MetadataBuffer[]} */
export function isMetadataBuffers(value: unknown): value is MetadataBuffer[];
/** Restore typed numeric arrays while leaving ordinary semantic values intact.
 * @param {import('../index.js').SimreadyMetadata} metadata
 * @param {MetadataBuffer[]} buffers
 * @param {{getDependency(type:string,index:number):Promise<unknown>}} parser
 */
export function restoreMetadataBuffers(metadata: import("../index.js").SimreadyMetadata, buffers: MetadataBuffer[], parser: {
    getDependency(type: string, index: number): Promise<unknown>;
}): Promise<void>;
export type MetadataBuffer = {
    path: Array<string | number>;
    bufferView: number;
    componentType: "float32" | "float64";
    shape: number[];
};
