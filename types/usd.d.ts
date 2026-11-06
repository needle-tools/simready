/** Preserve follower = multiplier * leader + offset using the PhysxMimicJointAPI
 * constraint: follower + gearing * leader + offset = 0.
 * Values use the snapshot's source units and degrees, without a glTF conversion.
 * @param {Pick<import('./index.js').PhysicsJoint,'mimic'> & {type?:string,usdJointState?:{position:number,velocity:number}}} joint
 * @param {(path:string)=>string} [resolvePath] Remap source identities to exported prim paths.
 * @returns {UsdJointMetadata}
 */
export function encodeUsdJointMetadata(joint: Pick<import("./index.js").PhysicsJoint, "mimic"> & {
    type?: string;
    usdJointState?: {
        position: number;
        velocity: number;
    };
}, resolvePath?: (path: string) => string): UsdJointMetadata;
/** Decode the same typed values and relationship targets returned by USD APIs.
 * An absent relationship means no coupling. Legacy simready:coupled* metadata
 * uses the same coefficient convention and remains readable.
 * @param {Record<string,unknown>} attributes
 * @param {Record<string,string[]>} relationships
 * @returns {Mimic|undefined}
 */
export function decodeUsdJointMetadata(attributes: Record<string, unknown>, relationships: Record<string, string[]>): Mimic | undefined;
export { prepareUsdPhysicsSnapshot } from "./usdPlanning.js";
export { getUsdJointState } from "./usdJointState.js";
export const USD_MIMIC_PROPERTIES: Readonly<{
    joint: "physxMimicJoint:rotX:referenceJoint";
    gearing: "physxMimicJoint:rotX:gearing";
    offset: "physxMimicJoint:rotX:offset";
}>;
export type Mimic = NonNullable<import("./index.js").PhysicsJoint["mimic"]>;
export type UsdJointMetadata = {
    apiSchemas: string[];
    attributes: Array<{
        name: string;
        type: "float" | "uniform token";
        value: number | string;
    }>;
    relationships: Array<{
        name: string;
        targets: string[];
    }>;
};
