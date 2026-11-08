const DB='cellcast-datasets';
export async function cacheDataset(key:string,value?:unknown):Promise<unknown>{
 return new Promise((resolve,reject)=>{
  const opening=indexedDB.open(DB,1);
  opening.onupgradeneeded=()=>opening.result.createObjectStore('previews');
  opening.onerror=()=>reject(opening.error);
  opening.onsuccess=()=>{const db=opening.result;const tx=db.transaction('previews',value===undefined?'readonly':'readwrite');const store=tx.objectStore('previews');const request=value===undefined?store.get(key):store.put(value,key);let result:unknown;request.onsuccess=()=>{result=request.result};tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error)}};
 });
}
