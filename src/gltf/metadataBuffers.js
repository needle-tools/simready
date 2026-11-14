// @ts-check
/** @typedef {{path:Array<string|number>,bufferView:number,componentType:'float32'|'float64',shape:number[]}} MetadataBuffer */
const own=(/** @type {object} */value,/** @type {string|number} */key)=>Object.prototype.hasOwnProperty.call(value,key);

/** @param {unknown} value @returns {value is MetadataBuffer[]} */
export function isMetadataBuffers(value){
 return Array.isArray(value)&&value.length>0&&value.every(row=>row&&typeof row==='object'
  &&Number.isInteger(row.bufferView)&&row.bufferView>=0&&['float32','float64'].includes(row.componentType)
  &&Array.isArray(row.path)&&row.path.length>0&&row.path.every((/** @type {unknown} */key)=>typeof key==='string'||typeof key==='number'&&Number.isSafeInteger(key)&&key>=0)
  &&Array.isArray(row.shape)&&row.shape.length>0&&row.shape.length<=8&&row.shape.every((/** @type {unknown} */n)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0));
}

/** Restore typed numeric arrays while leaving ordinary semantic values intact.
 * @param {import('../index.js').SimreadyMetadata} metadata
 * @param {MetadataBuffer[]} buffers
 * @param {{getDependency(type:string,index:number):Promise<unknown>}} parser
 */
export async function restoreMetadataBuffers(metadata,buffers,parser){
 for(const record of buffers){
  let parent=/** @type {unknown} */(metadata);
  for(const key of record.path.slice(0,-1)){
   if(!parent||typeof parent!=='object'||Array.isArray(parent)&&typeof key!=='number'||!own(parent,key))throw new Error('Invalid NEEDLE_simready metadata buffer path.');
   parent=/** @type {Record<string|number,unknown>} */(parent)[key];
  }
  const key=record.path[record.path.length-1];
  if(!parent||typeof parent!=='object'||Array.isArray(parent)&&typeof key!=='number'||!own(parent,key)||/** @type {Record<string|number,unknown>} */(parent)[key]!==null)throw new Error('Invalid NEEDLE_simready metadata buffer placeholder.');
  const bytes=await parser.getDependency('bufferView',record.bufferView),stride=record.componentType==='float32'?4:8;
  const count=record.shape.reduce((total,size)=>total*size,1);
  if(!Number.isSafeInteger(count)||!(bytes instanceof ArrayBuffer)||bytes.byteLength!==count*stride)throw new Error('Invalid NEEDLE_simready metadata buffer size.');
  const view=new DataView(bytes);let offset=0;
  /** @param {number} depth @returns {unknown[]} */
  const read=depth=>Array.from({length:record.shape[depth]},()=>{
   if(depth+1<record.shape.length)return read(depth+1);
   const value=record.componentType==='float32'?view.getFloat32(offset,true):view.getFloat64(offset,true);offset+=stride;
   if(!Number.isFinite(value))throw new Error('Invalid NEEDLE_simready metadata buffer value.');return value;
  });
  /** @type {Record<string|number,unknown>} */(parent)[key]=read(0);
 }
}
