// @ts-check
import {BufferGeometry,Float32BufferAttribute,LineBasicMaterial,LineSegments,Points,PointsMaterial} from 'three';

/** @overload
 * @param {string} kind @param {string} path @param {number[]} positions
 * @param {true} points @param {import('three').ColorRepresentation} [color]
 * @returns {Points<BufferGeometry,PointsMaterial>}
 */
/** @overload
 * @param {string} kind @param {string} path @param {number[]} positions
 * @param {false} [points] @param {import('three').ColorRepresentation} [color]
 * @returns {LineSegments<BufferGeometry,LineBasicMaterial>}
 */
/** @param {string} kind @param {string} path @param {number[]} positions
 * @param {boolean} [points] @param {import('three').ColorRepresentation} [color]
 */
export function helperGeometry(kind,path,positions,points=false,color=0x99cc33){
 const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));
 const options={color,transparent:true,opacity:.85,depthWrite:false,toneMapped:false};
 const object=points?new Points(geometry,new PointsMaterial({...options,size:5,sizeAttenuation:false}))
   :new LineSegments(geometry,new LineBasicMaterial(options));
 object.name=path.split('/').pop()+' '+kind;
 Object.assign(object.userData,{simreadyHelperFor:path,simreadyHelperKind:kind});
 return object;
}
/** @param {import('three').Object3D} object
 * @returns {object is import('three').Mesh | import('three').Line | import('three').Points}
 */
const renderObject=object=>('isMesh' in object&&object.isMesh===true)||('isLine' in object&&object.isLine===true)||('isPoints' in object&&object.isPoints===true);
/** @param {import('three').Object3D} object */
export function disposeHelper(object){
 object.removeFromParent();object.traverse(child=>{
  if(!renderObject(child))return;
  child.geometry.dispose();for(const material of [child.material].flat())material.dispose();
 });
}
