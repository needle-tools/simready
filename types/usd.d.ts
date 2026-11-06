/** Preserve follower = multiplier * leader + offset using the existing USD
 * metadata convention: follower + gearing * leader + offset = 0.
 * Values use the snapshot's source units and degrees, without a glTF conversion.
 * @param {Pick<import('./index.js').PhysicsJoint,'mimic'>} joint
 * @param {(path:string)=>string} [resolvePath] Remap source identities to exported prim paths.
 * @returns {UsdJointMetadata}
 */
export function encodeUsdJointMetadata(joint: Pick<import("./index.js").PhysicsJoint, "mimic">, resolvePath?: (path: string) => string): UsdJointMetadata;
/** Decode the same typed values and relationship targets returned by USD APIs.
 * An absent relationship means no coupling. Legacy simready:coupled* metadata
 * uses the same coefficient convention and remains readable.
 * @param {Record<string,unknown>} attributes
 * @param {Record<string,string[]>} relationships
 * @returns {Mimic|undefined}
 */
export function decodeUsdJointMetadata(attributes: Record<string, unknown>, relationships: Record<string, string[]>): Mimic | undefined;
/** SimReady joint metadata shared by USD writers and readers. No USD or DOM runtime required. */
export const USD_MIMIC_PROPERTIES: Readonly<{
    joint: "simready:mimicOf";
    gearing: "simready:mimicGearing";
    offset: "simready:mimicOffset";
}>;
export type Mimic = NonNullable<import("./index.js").PhysicsJoint["mimic"]>;
export type UsdJointMetadata = {
    attributes: Array<{
        name: string;
        type: "double";
        value: number;
    }>;
    relationships: Array<{
        name: string;
        targets: string[];
    }>;
};
