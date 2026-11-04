import {BufferGeometry,Float32BufferAttribute,LineBasicMaterial,LineSegments,Points,PointsMaterial} from 'three';
export function helperGeometry(kind,path,positions,points=false,color=0x99cc33){
 const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));
 const options={color,transparent:true,opacity:.85,depthWrite:false,toneMapped:false};
 const material=points?new PointsMaterial({...options,size:5,sizeAttenuation:false}):new LineBasicMaterial(options);
 const object=points?new Points(geometry,material):new LineSegments(geometry,material);
 object.name=path.split('/').pop()+' '+kind;
 Object.assign(object.userData,{simreadyHelperFor:path,simreadyHelperKind:kind});
 return object;
}
export function disposeHelper(object){object.removeFromParent();object.traverse(child=>{child.geometry?.dispose();for(const material of [child.material].flat())material?.dispose();});}
