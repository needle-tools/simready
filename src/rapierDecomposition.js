// @ts-check

/**
 * Cook in a centered unit box so VHACD's floating-point predicates do not depend
 * on the asset's local origin or units. Restore every hull to the collider frame
 * before mass properties and contacts are constructed.
 * @param {import('./rapier-types.js').RapierModule} R
 * @param {Extract<import('./description.js').ShapeDescription,{type:'convexDecomposition'}>} shape
 * @param {string} path
 */
export function cookConvexDecomposition(R,shape,path){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<shape.points.length;i++){
  const axis=i%3,value=shape.points[i];min[axis]=Math.min(min[axis],value);max[axis]=Math.max(max[axis],value);
 }
 const extent=Math.max(...max.map((value,axis)=>value-min[axis]));
 if(!(extent>0)||!Number.isFinite(extent))return null;
 const center=min.map((value,axis)=>(value+max[axis])/2);
 const points=Float32Array.from(shape.points,(value,index)=>(value-center[index%3])/extent);
 // Keep the decomposition budget and contact flags unchanged. Normal clamping
 // across cuts discards valid contacts between thin, curved compound shapes.
 const descriptor=R.ColliderDesc.convexDecomposition?.(points,shape.indices,
  {resolution:shape.resolution??64,concavity:shape.concavity??.001,maxConvexHulls:shape.maxHulls??128},0);
 if(!descriptor)return null;
 const compound=descriptor.shape;
 if(!compound?.shapes||!compound.positions||compound.shapes.length!==compound.positions.length)throw new Error(`Invalid decomposition compound at ${path}.`);
 for(let i=0;i<compound.shapes.length;i++){
  const vertices=compound.shapes[i].vertices,position=compound.positions[i];
  if(!vertices)throw new Error(`Missing decomposition hull vertices at ${path}.`);
  for(let vertex=0;vertex<vertices.length;vertex++)vertices[vertex]*=extent;
  position.x=position.x*extent+center[0];position.y=position.y*extent+center[1];position.z=position.z*extent+center[2];
 }
 return descriptor;
}
