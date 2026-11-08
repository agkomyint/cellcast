"""Export the exact scPlantLLM pre-norm embedding path with Arabidopsis vocab.
The upstream residual ordering differs from torch's norm_first implementation.
No inference tensor is initialized randomly or silently skipped during loading.
"""
import ast,hashlib,json,pathlib,typing,warnings
import torch,numpy as np,onnx,onnxruntime as ort
from torch import nn,Tensor
import torch.nn.functional as F
ROOT=pathlib.Path(__file__).resolve().parents[1];P=ROOT/'experiments/scplant';OUT=ROOT/'public/models'
torch.set_num_threads(4);torch.backends.mha.set_fastpath_enabled(False)
class CPUFlash(nn.MultiheadAttention):
    def __init__(self,embed_dim,num_heads,batch_first=True,attention_dropout=0,**kwargs):super().__init__(embed_dim,num_heads,dropout=attention_dropout,batch_first=batch_first,**kwargs)
    def forward(self,x,key_padding_mask=None):return super().forward(x,x,x,key_padding_mask=None if key_padding_mask is None else ~key_padding_mask,need_weights=False)
scope={**vars(typing),'torch':torch,'nn':nn,'Tensor':Tensor,'F':F,'FlashMHA':CPUFlash,'warnings':warnings}
tree=ast.parse((P/'model.py').read_text());needed=['GeneEncoder','CategoryValueEncoder','FlashTransformerEncoderLayer']
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.ClassDef) and n.name in needed],type_ignores=[]),'<upstream-scplant>','exec'),scope)
class Model(nn.Module):
    def __init__(self,ntoken):
        super().__init__();self.encoder=scope['GeneEncoder'](ntoken,512,padding_idx=0);self.value_encoder=scope['CategoryValueEncoder'](103,512,padding_idx=-2)
        layer=scope['FlashTransformerEncoderLayer'](512,8,512,0,batch_first=True,norm_scheme='pre');self.transformer_encoder=nn.Module();self.transformer_encoder.layers=nn.ModuleList([__import__('copy').deepcopy(layer) for _ in range(6)])
    def forward(self,src,values,mask):
        x=self.encoder(src)+self.value_encoder(values)
        for layer in self.transformer_encoder.layers:x=layer(x,src_key_padding_mask=mask)
        return x[:,0,:]
def main():
    ckpt=P/'checkpoint.pth';assert hashlib.sha256(ckpt.read_bytes()).hexdigest()=='baa24dc1e686b94aa08e7e7b08df17e1bb53e479416acf7f50cd032b0fabf416'
    state=torch.load(ckpt,map_location='cpu',weights_only=True);mapped={k.replace('.Wqkv.weight','.in_proj_weight').replace('.Wqkv.bias','.in_proj_bias'):v for k,v in state.items()}
    vocab=json.loads((P/'gene_vocab.json').read_text());arab=[g for g in vocab if g.startswith('AT')];kept=['<PAD>']+arab+['<cls>'];compact={g:i for i,g in enumerate(kept)}
    original=Model(len(vocab)).eval();expected=original.state_dict();original.load_state_dict({k:mapped[k] for k in expected},strict=True)
    model=Model(len(kept)).eval();compact_state={k:mapped[k] for k in model.state_dict()};compact_state['encoder.embedding.weight']=mapped['encoder.embedding.weight'][[vocab[g] for g in kept]];model.load_state_dict(compact_state,strict=True)
    real=json.loads((OUT/'scplant-real-profiles.json').read_text());cases=[]
    for profile in real['profiles']:
        args=(torch.tensor([profile['src']]),torch.tensor([profile['values']]),torch.tensor([profile['mask']]))
        fullids=torch.tensor([[vocab[kept[i]] for i in profile['src']]])
        with torch.no_grad():ref=original(fullids,args[1],args[2]);compact_ref=model(*args)
        assert torch.allclose(ref,compact_ref,atol=1e-6,rtol=1e-6)
        if not cases:torch.onnx.export(model,args,str(OUT/'scplant.onnx'),input_names=['src','values','mask'],output_names=['cell_embedding'],opset_version=17,dynamo=False)
        session=ort.InferenceSession(str(OUT/'scplant.onnx'),providers=['CPUExecutionProvider']);actual=session.run(None,dict(zip(['src','values','mask'],[a.numpy() for a in args])))[0]
        error=float(np.max(np.abs(actual-ref.numpy())));assert np.allclose(actual,ref.numpy(),atol=3e-4,rtol=3e-4),error
        profile['expected']=ref[0].tolist();cases.append({'cell':profile['id'],'max_abs_error':error,'compact_vocab_error':float((ref-compact_ref).abs().max())})
    onnx.checker.check_model(str(OUT/'scplant.onnx'));(OUT/'scplant-real-profiles.json').write_text(json.dumps(real,indent=2));(OUT/'scplant-vocab.json').write_text(json.dumps(compact))
    report={'model':'scPlantLLM','task':'Arabidopsis cell embeddings, not perturbation prediction','upstream':json.loads((P/'revision.json').read_text()),'checkpoint_sha256':hashlib.sha256(ckpt.read_bytes()).hexdigest(),'onnx_sha256':hashlib.sha256((OUT/'scplant.onnx').read_bytes()).hexdigest(),'onnx_bytes':(OUT/'scplant.onnx').stat().st_size,'vocabulary_rows':len(kept),'original_vocabulary_rows':len(vocab),'loaded_tensors':len(model.state_dict()),'excluded_tensors':[k for k in mapped if k not in expected],'cases':cases,'profile_scope':'Measured partial gene panel; shortened input is not biologically validated','attention':'Original upstream pre-norm residual order, FlashMHA replaced by mathematically equivalent PyTorch attention'}
    (OUT/'scplant-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
if __name__=='__main__':main()
