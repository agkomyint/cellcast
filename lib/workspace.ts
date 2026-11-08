import type { Result } from './runtime';

export type Run = {id:string;gene:string;cell:string;mode:string;result:Result;time:string};
export type Workspace = {
  version:1; section:string; gene:string; cell:string; mode:string; provider:string;
  search:string; cluster:number; zoom:number; result?:Result; history:Run[];
};
export const WORKSPACE_KEY='cellcast-workspace-v1';
const sections=['Overview','Experiment Lab','Dataset Explorer','Model & Runtime','Research History'];
const cells=['T cell','B cell','Natural killer cell','Monocyte'];
const modes=['Input ablation','Control reconstruction'];
const providers=['wasm','webgpu'];
function isResult(value:unknown):value is Result {
  if(!value || typeof value!=='object')return false;
  const r=value as Result;
  return [r.control,r.treatment].every(a=>Array.isArray(a)&&a.length===128&&a.every(Number.isFinite)) &&
    Number.isFinite(r.latency)&&r.latency>=0&&Number.isFinite(r.maxError)&&r.maxError>=0&&providers.includes(r.provider);
}
function isRun(value:unknown):value is Run {
  if(!value||typeof value!=='object')return false;
  const r=value as Run;
  return typeof r.id==='string'&&typeof r.gene==='string'&&cells.includes(r.cell)&&modes.includes(r.mode)&&
    typeof r.time==='string'&&Number.isFinite(Date.parse(r.time))&&isResult(r.result);
}
export function readWorkspace(storage:Storage):Partial<Workspace> {
  const raw=storage.getItem(WORKSPACE_KEY);
  let value:Partial<Workspace>={};
  try {const parsed=JSON.parse(raw||'null');if(parsed?.version===1)value=parsed;}catch{}
  const safe:Partial<Workspace>={};
  if(sections.includes(value.section!))safe.section=value.section;
  if(typeof value.gene==='string'&&value.gene.length<100)safe.gene=value.gene;
  if(cells.includes(value.cell!))safe.cell=value.cell;
  if(modes.includes(value.mode!))safe.mode=value.mode;
  if(providers.includes(value.provider!))safe.provider=value.provider;
  if(typeof value.search==='string')safe.search=value.search.slice(0,200);
  if(Number.isInteger(value.cluster)&&value.cluster!>=-1&&value.cluster!<=3)safe.cluster=value.cluster;
  if(Number.isFinite(value.zoom)&&value.zoom!>=.8&&value.zoom!<=2)safe.zoom=value.zoom;
  if(isResult(value.result))safe.result=value.result;
  let history=value.history;
  if(!Array.isArray(history)) {try{history=JSON.parse(storage.getItem('cellcast-history')||'[]')}catch{}}
  safe.history=Array.isArray(history)?history.filter(isRun).slice(0,20):[];
  return safe;
}
export function writeWorkspace(storage:Storage,workspace:Workspace) {
  storage.setItem(WORKSPACE_KEY,JSON.stringify(workspace));
}
