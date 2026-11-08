import { infer } from './runtime';
self.onmessage = async (event) => {
  try {
    const {fixture,index,ablate,provider}=event.data;
    const result=await infer(fixture,index,ablate,provider,(message)=>self.postMessage({type:'progress',message}));
    self.postMessage({type:'result',result});
  } catch(error) { self.postMessage({type:'error',message:error instanceof Error?error.message:String(error)}); }
};
