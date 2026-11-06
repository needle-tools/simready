// @ts-check
import {validateSnapshot, getSnapshotIssues} from './index.js';
import {getUsdJointState} from './usdJointState.js';

/** @typedef {import('./index.js').PhysicsJoint & {articulationRoot?:boolean,usdJointState?:{position:number,velocity:number}}} UsdPhysicsJoint */
/** @typedef {import('./index.js').PhysicsBody & {usdSyntheticBase?:boolean,articulationRoot?:boolean}} UsdPhysicsBody */
/** @typedef {Omit<import('./index.js').PhysicsSnapshot,'bodies'|'joints'> & {bodies:UsdPhysicsBody[],joints:UsdPhysicsJoint[]}} UsdPhysicsSnapshot */

function forest() {
    /** @type {Map<string,string>} */
    const parents = new Map();
    /** @param {string} value @returns {string} */
    const find = value => {
        const parent = parents.get(value);
        if (!parent) { parents.set(value,value); return value; }
        if (parent === value) return value;
        const root = find(parent); parents.set(value,root); return root;
    };
    /** @param {string} a @param {string} b */
    const join = (a,b) => { const x=find(a),y=find(b); if(x===y)return false; parents.set(x,y);return true; };
    return {find,join};
}

/** Plan native PhysX mimic articulations without modifying source records.
 * A shared fixed identity base replaces world endpoints only for grounded
 * components required by a coupling. Floating components must already connect.
 * Mandatory mimic/reference edges are retained; other cycle edges become
 * ordinary maximal-coordinate closure constraints. Existing articulation
 * membership and kinematic/disabled links require an explicit caller adaptation.
 * The result describes a schema export, not Foundation profile certification.
 * @param {import('./index.js').PhysicsSnapshot} source
 * @param {{jointState?:boolean}} [options] Author state for all enabled scalar joints, including uncoupled assets.
 * @returns {UsdPhysicsSnapshot}
 */
export function prepareUsdPhysicsSnapshot(source,{jointState=false}={}) {
    validateSnapshot(source);
    const issues=getSnapshotIssues(source);
    if(issues.length)throw new Error('USD physics: '+issues.map(i=>i.path+': '+i.reason).join('; '));
    const snapshot=/** @type {UsdPhysicsSnapshot} */(structuredClone(source));
    const followers=snapshot.joints.filter(j=>j.mimic);
    const addAllStates=()=>{if(jointState)for(const joint of snapshot.joints)if(joint.jointEnabled!==false){const state=getUsdJointState(snapshot,joint);if(state)joint.usdJointState=state;}};
    if(!followers.length){addAllStates();return snapshot;}
    const bodies=new Map(snapshot.bodies.map(b=>[b.path,b]));
    const joints=new Map(snapshot.joints.map(j=>[j.path,j]));
    const mechanical=forest(),groups=forest();
    /** @param {UsdPhysicsJoint} joint */
    const endpoint=joint=>joint.body0||joint.body1||'';
    for(const b of snapshot.bodies)mechanical.find(b.path);
    for(const j of snapshot.joints)if(j.body0&&j.body1)mechanical.join(j.body0,j.body1);
    /** @type {Set<string>} */
    const grounded=new Set();
    for(const j of snapshot.joints)if(!j.body0!==!j.body1)grounded.add(mechanical.find(endpoint(j)));
    /** @type {Set<string>} */
    const mandatory=new Set();
    for(const follower of followers){
        const mimic=/** @type {NonNullable<UsdPhysicsJoint['mimic']>} */(follower.mimic);
        const reference=joints.get(mimic.joint);
        if(!reference)throw new Error('USD mimic reference is missing: '+mimic.joint);
        if(!Number.isFinite(mimic.multiplier)||mimic.multiplier===0||!Number.isFinite(mimic.offset))throw new Error('USD mimic requires finite nonzero gearing and a finite offset: '+follower.path);
        const seen=new Set([follower.path]);let cursor=reference;
        while(cursor){
            if(seen.has(cursor.path))throw new Error('USD mimic dependency cycle: '+follower.path);
            seen.add(cursor.path);if(!cursor.mimic)break;
            cursor=/** @type {UsdPhysicsJoint} */(joints.get(cursor.mimic.joint));
        }
        for(const joint of [follower,reference]){
            if(!['revolute','prismatic'].includes(joint.type)||!endpoint(joint)||joint.jointEnabled===false||joint.excludeFromArticulation)throw new Error('USD mimic needs an enabled articulation revolute/prismatic joint: '+joint.path);
            const lower=joint.limit?.enabled?(joint.limit.lower??-Infinity):-Infinity;
            const upper=joint.limit?.enabled?(joint.limit.upper??Infinity):Infinity;
            if(Number.isNaN(lower)||Number.isNaN(upper)||lower>=upper)throw new Error('USD mimic needs nonempty joint limits: '+joint.path);
            // Author unbounded limits explicitly; do not invent finite travel.
            joint.limit={enabled:true,lower,upper};
            mandatory.add(joint.path);
        }
        const a=mechanical.find(endpoint(follower)),b=mechanical.find(endpoint(reference));
        if(a!==b&&(!grounded.has(a)||!grounded.has(b)))throw new Error('USD mimic cannot connect disconnected floating components: '+follower.path);
        groups.join(a,b);
    }
    const selected=new Set(followers.map(j=>groups.find(mechanical.find(endpoint(j)))));
    const occupied=new Set([...snapshot.bodies,...snapshot.joints,...snapshot.shapes,...snapshot.scenes,...snapshot.materials,...snapshot.groups,...(snapshot.articulations||[])].map(x=>x.path));
    /** @param {string} stem */
    const unique=stem=>{let path=stem,n=1;while(occupied.has(path))path=stem+'_'+n++;occupied.add(path);return path;};
    for(const component of selected){
        const members=snapshot.bodies.filter(b=>groups.find(mechanical.find(b.path))===component);
        const ids=new Set(members.map(b=>b.path));
        const edges=snapshot.joints.filter(j=>ids.has(j.body0||'')||ids.has(j.body1||''));
        if((snapshot.articulations||[]).some(a=>a.articulatedBodies.some(p=>ids.has(p))))throw new Error('USD mimic planning requires explicit handling of existing articulation membership.');
        for(const b of members)if(b.rigidBodyEnabled===false||b.kinematicBody)throw new Error('USD mimic articulation cannot silently convert a disabled or kinematic body: '+b.path);
        for(const j of edges)if(j.jointEnabled===false||!['fixed','revolute','prismatic','spherical'].includes(j.type))throw new Error('USD mimic articulation contains a disabled or unsupported joint: '+j.path);
        const owners=new Set(members.map(b=>b.simulationOwners?.[0]||snapshot.scenes[0]?.path||''));
        if(owners.size>1||members.some(b=>(b.simulationOwners?.length||0)>1))throw new Error('USD mimic articulation must have one simulation owner.');
        const anchored=edges.some(j=>!j.body0||!j.body1);
        /** @type {string} */
        let root;
        if(anchored){
            const path=unique('/__UsdMimicBase');
            const base=/** @type {UsdPhysicsBody} */({path,position:[0,0,0],rotation:[0,0,0,1],rigidBodyEnabled:true,kinematicBody:false,mass:1,diagonalInertia:[1,1,1],usdSyntheticBase:true});
            const owner=[...owners][0];if(owner)base.simulationOwners=[owner];
            snapshot.bodies.push(base);members.push(base);ids.add(path);
            for(const j of edges){if(!j.body0)j.body0=path;if(!j.body1)j.body1=path;}
            root=unique('/__UsdMimicRoot');
            snapshot.joints.push({path:root,type:'fixed',body1:path,position0:[0,0,0],position1:[0,0,0],rotation0:[0,0,0,1],rotation1:[0,0,0,1],jointEnabled:true,collisionEnabled:false,articulationRoot:true});
        }else{
            root=members[0].path;members[0].articulationRoot=true;
        }
        const tree=forest();for(const b of members)tree.find(b.path);
        const kept=[];
        for(const joint of [...edges.filter(j=>mandatory.has(j.path)),...edges.filter(j=>!mandatory.has(j.path))]){
            if(joint.excludeFromArticulation)continue;
            if(!tree.join(joint.body0||'',joint.body1||'')){
                if(mandatory.has(joint.path))throw new Error('USD mimic/reference joints form an articulation cycle: '+joint.path);
                joint.excludeFromArticulation=true;
            }else kept.push(joint.path);
        }
        if(new Set(members.map(b=>tree.find(b.path))).size!==1)throw new Error('USD mimic articulation is disconnected after excluding closure joints.');
        for(const joint of edges)if(kept.includes(joint.path)){const state=getUsdJointState(snapshot,joint);if(state)joint.usdJointState=state;}
        (snapshot.articulations??=[]).push({path:root,rootPrims:[root],filteredCollisions:[],articulatedBodies:members.map(b=>b.path),articulatedJoints:anchored?[root,...kept]:kept});
    }
    addAllStates();
    return snapshot;
}
