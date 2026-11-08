type Session=import('onnxruntime-web').InferenceSession;
let session:Session|undefined;
let modelId='';
self.onmessage=async({data})=>{
 try{
  const ort=await import('onnxruntime-web/webgpu');ort.env.wasm.wasmPaths='/ort/';ort.env.wasm.numThreads=1;
  if(data.type==='unload'){await session?.release();session=undefined;modelId='';self.postMessage({type:'unloaded'});return}
  if(data.type==='load'){
   const paths:Record<string,string>={scplant:'/models/scplant.onnx',scgpt:'/models/scgpt.onnx'};
   if(!paths[data.modelId])throw Error('Model is not available as a browser export');
   await session?.release();session=undefined;modelId='';
   self.postMessage({type:'progress',message:`Loading ${data.modelId} weights into ${data.provider.toUpperCase()}…`});
   const start=performance.now();session=await ort.InferenceSession.create(paths[data.modelId],{executionProviders:[data.provider]});modelId=data.modelId;
   self.postMessage({type:'loaded',modelId,loadMs:performance.now()-start});return;
  }
  if(data.type==='run'){
   if(!session)throw Error('Load a model before running a cell');
   const p=data.profile;if(!p||p.src?.length!==128||p.values?.length!==128||p.mask?.length!==128)throw Error('Expected a 128-position source profile');
   const feeds={src:new ort.Tensor('int64',BigInt64Array.from(p.src.map(BigInt)),[1,128]),values:modelId==='scplant'?new ort.Tensor('int64',BigInt64Array.from(p.values.map(BigInt)),[1,128]):new ort.Tensor('float32',Float32Array.from(p.values),[1,128]),mask:new ort.Tensor('bool',Uint8Array.from(p.mask.map(Number)),[1,128])};
   const start=performance.now();const output=await session.run(feeds);const values=Array.from(output[modelId==='scplant'?'cell_embedding':'predicted_expression'].data as Float32Array);const latencyMs=performance.now()-start;
   if(!values.every(Number.isFinite))throw Error('Model returned non-finite outputs');
   const maxAbsError=p.expected?.length===values.length?Math.max(...values.map((v,i)=>Math.abs(v-p.expected[i]))):undefined;
   if(maxAbsError!==undefined&&maxAbsError>.001)throw Error(`Numerical parity check failed (${maxAbsError}). Output withheld.`);
   self.postMessage({type:'result',values,latencyMs,maxAbsError,modelId,cell:p.id});
  }
 }catch(e){self.postMessage({type:'error',message:e instanceof Error?e.message:String(e)})}
};
