// @ts-check
import {Quaternion,Vector3} from 'three';
import {jointValue} from './jointCoordinates.js';

/** Measure scalar rest position and velocity from authored world poses and joint
 * frames. Angular results use degrees; linear results use stage distance units.
 * Full revolutions are ambiguous in a pose, so choose the nearest valid authored
 * turn while retaining the principal angle whenever it is inside the limits.
 * @param {import('./index.js').PhysicsSnapshot} snapshot
 * @param {import('./index.js').PhysicsJoint} joint
 * @returns {{position:number,velocity:number}|null}
 */
export function getUsdJointState(snapshot,joint){
    if(!['revolute','prismatic'].includes(joint.type))return null;
    const records=new Map(snapshot.bodies.map(b=>[b.path,b]));
    /** @param {string|undefined} path */
    const body=path=>{const value=path?records.get(path):undefined;if(path&&!value)throw new Error('USD joint state references missing body: '+path);return value;};
    /** @param {import('./index.js').PhysicsBody|undefined} b */
    const rotation=b=>new Quaternion(...(b?.rotation||[0,0,0,1])).normalize();
    const a=body(joint.body0),b=body(joint.body1);
    const poses=new Map(snapshot.bodies.map(data=>[data.path,{body:{translation:()=>new Vector3(...data.position),rotation:()=>rotation(data),isDynamic:()=>true}}]));
    const position=/** @type {number} */(jointValue(joint,poses));
    const frame=rotation(a).multiply(new Quaternion(...(joint.rotation0||[0,0,0,1])).normalize());
    const axis=new Vector3(...(joint.axis==='Y'?[0,1,0]:joint.axis==='Z'?[0,0,1]:[1,0,0])).applyQuaternion(frame);
    const wa=new Vector3(...(a?.angularVelocity||[0,0,0])),wb=new Vector3(...(b?.angularVelocity||[0,0,0]));
    let velocity;
    if(joint.type==='revolute')velocity=wb.sub(wa).dot(axis);
    else{
        wa.multiplyScalar(Math.PI/180);wb.multiplyScalar(Math.PI/180);
        const ra=new Vector3(...(joint.position0||[0,0,0])).applyQuaternion(rotation(a));
        const rb=new Vector3(...(joint.position1||[0,0,0])).applyQuaternion(rotation(b));
        const va=new Vector3(...(a?.linearVelocity||[0,0,0])).add(new Vector3().crossVectors(wa,ra));
        const vb=new Vector3(...(b?.linearVelocity||[0,0,0])).add(new Vector3().crossVectors(wb,rb));
        const delta=rb.clone().add(new Vector3(...(b?.position||[0,0,0]))).sub(ra).sub(new Vector3(...(a?.position||[0,0,0])));
        velocity=vb.sub(va).dot(axis)+delta.dot(new Vector3().crossVectors(wa,axis));
    }
    if(!Number.isFinite(position)||!Number.isFinite(velocity))throw new Error('USD joint rest state is not finite: '+joint.path);
    return {position,velocity};
}
