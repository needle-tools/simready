// @ts-check
/** Official PhysX USD joint metadata. No USD or DOM runtime required. */
export {prepareUsdPhysicsSnapshot} from './usdPlanning.js';
export {getUsdJointState} from './usdJointState.js';

export const USD_MIMIC_PROPERTIES = Object.freeze({
    joint: 'physxMimicJoint:rotX:referenceJoint',
    gearing: 'physxMimicJoint:rotX:gearing',
    offset: 'physxMimicJoint:rotX:offset',
});

/** @typedef {NonNullable<import('./index.js').PhysicsJoint['mimic']>} Mimic */
/** @typedef {{apiSchemas:string[],attributes:Array<{name:string,type:'float'|'uniform token',value:number|string}>,relationships:Array<{name:string,targets:string[]}>}} UsdJointMetadata */

/** @param {Mimic} mimic */
function validateMimic(mimic) {
    if (typeof mimic.joint !== 'string' || !mimic.joint.startsWith('/') || /[<>\s]/.test(mimic.joint))
        throw new TypeError('SimReady mimic requires an absolute USD joint path.');
    if (!Number.isFinite(mimic.multiplier) || !Number.isFinite(mimic.offset))
        throw new TypeError('SimReady mimic coefficients must be finite.');
}

/** Preserve follower = multiplier * leader + offset using the PhysxMimicJointAPI
 * constraint: follower + gearing * leader + offset = 0.
 * Values use the snapshot's source units and degrees, without a glTF conversion.
 * @param {Pick<import('./index.js').PhysicsJoint,'mimic'> & {type?:string,usdJointState?:{position:number,velocity:number}}} joint
 * @param {(path:string)=>string} [resolvePath] Remap source identities to exported prim paths.
 * @returns {UsdJointMetadata}
 */
export function encodeUsdJointMetadata(joint, resolvePath = path => path) {
    /** @type {UsdJointMetadata} */
    const state={apiSchemas:[],attributes:[],relationships:[]};
    if(joint.usdJointState){
        if(!['revolute','prismatic'].includes(joint.type||''))throw new TypeError('Scalar USD joint state requires a revolute or prismatic joint.');
        const axis=joint.type==='prismatic'?'linear':'angular';
        state.apiSchemas.push('PhysicsJointStateAPI:'+axis);
        for(const key of /** @type {const} */(['position','velocity'])){
            const value=joint.usdJointState[key];if(!Number.isFinite(value))throw new TypeError('USD joint state must be finite.');
            state.attributes.push({name:'state:'+axis+':physics:'+key,type:'float',value});
        }
    }
    if (!joint.mimic) return state;
    validateMimic(joint.mimic);
    if(joint.mimic.multiplier===0)throw new TypeError('PhysX mimic gearing must be nonzero.');
    const mimic={...joint.mimic,joint:resolvePath(joint.mimic.joint)};
    validateMimic(mimic);
    return {
        apiSchemas:[...state.apiSchemas,'PhysxMimicJointAPI:rotX'],
        attributes:[...state.attributes,
            {name:'physxMimicJoint:rotX:referenceJointAxis',type:'uniform token',value:'rotX'},
            {name:USD_MIMIC_PROPERTIES.gearing,type:'float',value:-mimic.multiplier},
            {name:USD_MIMIC_PROPERTIES.offset,type:'float',value:-mimic.offset},
            {name:'physxMimicJoint:rotX:naturalFrequency',type:'float',value:-1},
            {name:'physxMimicJoint:rotX:dampingRatio',type:'float',value:-1},
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
    const official=Object.keys(relationships).filter(name=>/^physxMimicJoint:(rotX|rotY|rotZ):referenceJoint$/.test(name)&&relationships[name]?.length);
    if(official.length>1)throw new TypeError('Multiple USD mimic axes cannot represent a single-DOF coupling.');
    const name=official[0]??['simready:mimicOf','simready:coupledOf'].find(name=>relationships[name]?.length);
    if (!name) return undefined;
    if (relationships[name].length!==1) throw new TypeError('SimReady mimic requires exactly one reference joint.');
    const native=name.startsWith('physxMimicJoint:');
    const prefix=native?name.slice(0,-'referenceJoint'.length):name.slice(0,-2);
    const gearing=attributes[prefix+(native?'gearing':'Gearing')]??1,offset=attributes[prefix+(native?'offset':'Offset')]??0;
    if(typeof gearing!=='number'||typeof offset!=='number')throw new TypeError('SimReady mimic coefficients must be numbers.');
    const mimic={joint:relationships[name][0],multiplier:-gearing,offset:-offset};
    validateMimic(mimic);
    return mimic;
}
