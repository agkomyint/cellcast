export type Fixture = {genes:string[];src:number[];values:number[];mask:boolean[];expected:number[];description:string};
export type Result = {control:number[];treatment:number[];latency:number;provider:string;maxError:number};
let session: import('onnxruntime-web').InferenceSession | undefined;
let activeProvider = '';
export async function infer(f:Fixture, index:number, ablate:boolean, provider:string, progress:(s:string)=>void):Promise<Result> {
  const ort = await import('onnxruntime-web/webgpu');
  ort.env.wasm.wasmPaths = '/ort/';
  ort.env.wasm.numThreads = 1;
  if (!session || activeProvider!==provider) {
    progress(`Loading scGPT · 205 MB · ${provider.toUpperCase()}`);
    await session?.release(); session=undefined;
    session=await ort.InferenceSession.create('/models/scgpt.onnx',{executionProviders:[provider],graphOptimizationLevel:'all'});
    activeProvider=provider;
  }
  const run=async (values:number[])=> {
    const outputs=await session!.run({src:new ort.Tensor('int64',BigInt64Array.from(f.src.map(BigInt)),[1,128]),values:new ort.Tensor('float32',Float32Array.from(values),[1,128]),mask:new ort.Tensor('bool',Uint8Array.from(f.mask.map(Number)),[1,128])});
    const data=Array.from(outputs.predicted_expression.data as Float32Array);
    if(data.length!==128 || !data.every(Number.isFinite)) throw new Error('Model returned invalid expression values');
    return data;
  };
  progress('Running control and treatment locally…');
  const start=performance.now(); const control=await run(f.values);
  const maxError=Math.max(...control.map((v,i)=>Math.abs(v-f.expected[i])));
  if(maxError>0.0002) throw new Error(`Numerical verification failed: max error ${maxError}. Results withheld.`);
  const values=[...f.values]; if(ablate) values[index]=0;
  const treatment=ablate?await run(values):[...control];
  return {control,treatment,latency:performance.now()-start,provider,maxError};
}
