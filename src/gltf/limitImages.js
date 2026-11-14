// @ts-check
const limited=new WeakSet();

/** Bound embedded-image Blob lifetimes while Three loads a SimReady asset.
 * Large atlases can otherwise exceed the browser's Blob memory quota even
 * when the decoded preview images are small.
 * @param {object} parser
 */
export function limitImageRequests(parser){
 const load=Reflect.get(parser,'loadImageSource');
 if(limited.has(parser)||typeof load!=='function')return;
 limited.add(parser);
 let active=0;
 /** @type {Array<()=>void>} */
 const waiting=[];
 /** @type {(...args:unknown[])=>Promise<unknown>} */
 const bounded=async(...args)=>{
  if(active>=2)await new Promise(resolve=>waiting.push(()=>resolve(undefined)));
  else active++;
  try{return await Reflect.apply(load,parser,args);}
  finally{const wake=waiting.shift();if(wake)wake();else active--;}
 };
 Reflect.set(parser,'loadImageSource',bounded);
}
