// @ts-check
/** SimReady joint metadata shared by USD writers and readers. No USD or DOM runtime required. */

export const USD_MIMIC_PROPERTIES = Object.freeze({
    joint: 'simready:mimicOf',
    gearing: 'simready:mimicGearing',
    offset: 'simready:mimicOffset',
});

/** @typedef {NonNullable<import('./index.js').PhysicsJoint['mimic']>} Mimic */
/** @typedef {{attributes:Array<{name:string,type:'double',value:number}>,relationships:Array<{name:string,targets:string[]}>}} UsdJointMetadata */

/** @param {Mimic} mimic */
function validateMimic(mimic) {
    if (typeof mimic.joint !== 'string' || !mimic.joint.startsWith('/') || /[<>\s]/.test(mimic.joint))
        throw new TypeError('SimReady mimic requires an absolute USD joint path.');
    if (!Number.isFinite(mimic.multiplier) || !Number.isFinite(mimic.offset))
        throw new TypeError('SimReady mimic coefficients must be finite.');
}

/** Preserve follower = multiplier * leader + offset using the existing USD
 * metadata convention: follower + gearing * leader + offset = 0.
 * Values use the snapshot's source units and degrees, without a glTF conversion.
 * @param {Pick<import('./index.js').PhysicsJoint,'mimic'>} joint
 * @param {(path:string)=>string} [resolvePath] Remap source identities to exported prim paths.
 * @returns {UsdJointMetadata}
 */
export function encodeUsdJointMetadata(joint, resolvePath = path => path) {
    if (!joint.mimic) return {attributes:[],relationships:[]};
    validateMimic(joint.mimic);
    const mimic={...joint.mimic,joint:resolvePath(joint.mimic.joint)};
    validateMimic(mimic);
    return {
        attributes:[
            {name:USD_MIMIC_PROPERTIES.gearing,type:'double',value:-mimic.multiplier},
            {name:USD_MIMIC_PROPERTIES.offset,type:'double',value:-mimic.offset},
        ],
        relationships:[{name:USD_MIMIC_PROPERTIES.joint,targets:[mimic.joint]}],
    };
}

/** Decode the same typed values and relationship targets returned by USD APIs.
 * An absent relationship means no coupling. Legacy simready:coupled* metadata
 * uses the same coefficient convention and remains readable.
 * @param {Record<string,unknown>} attributes
 * @param {Record<string,string[]>} relationships
 * @returns {Mimic|undefined}
 */
export function decodeUsdJointMetadata(attributes, relationships) {
    const name=['simready:mimicOf','simready:coupledOf'].find(name=>relationships[name]?.length);
    if (!name) return undefined;
    if (relationships[name].length!==1) throw new TypeError('SimReady mimic requires exactly one reference joint.');
    const prefix=name.slice(0,-2),gearing=attributes[prefix+'Gearing']??1,offset=attributes[prefix+'Offset']??0;
    if(typeof gearing!=='number'||typeof offset!=='number')throw new TypeError('SimReady mimic coefficients must be numbers.');
    const mimic={joint:relationships[name][0],multiplier:-gearing,offset:-offset};
    validateMimic(mimic);
    return mimic;
}
