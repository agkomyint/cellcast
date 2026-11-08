"""Export the pretrained expression-reconstruction path; NOT a perturbation model.

Uses upstream GeneEncoder, ContinuousValueEncoder and ExprDecoder definitions
without importing scGPT's optional CUDA/torchtext/scientific dependencies.
"""
import ast, json, hashlib, pathlib, time
import numpy as np
import torch
from torch import nn, Tensor
from typing import Optional, Dict
import onnx, onnxruntime as ort

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/models'
CKPT = ROOT / 'experiments/checkpoint'
torch.set_num_threads(4)
torch.backends.mha.set_fastpath_enabled(False)
source = (ROOT / 'experiments/upstream_model.py').read_text()
tree = ast.parse(source)
classes = ['GeneEncoder', 'ContinuousValueEncoder', 'ExprDecoder']
scope = dict(nn=nn, torch=torch, Tensor=Tensor, Optional=Optional, Dict=Dict)
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n, ast.ClassDef) and n.name in classes], type_ignores=[]), '<upstream-scgpt>', 'exec'), scope)

class Reconstruction(nn.Module):
    def __init__(self, vocab, cfg):
        super().__init__()
        d = cfg['embsize']
        self.encoder = scope['GeneEncoder'](len(vocab), d, vocab['<pad>'])
        self.value_encoder = scope['ContinuousValueEncoder'](d, 0)
        layer = nn.TransformerEncoderLayer(d, cfg['nheads'], cfg['d_hid'], 0, batch_first=True)
        self.transformer_encoder = nn.TransformerEncoder(layer, cfg['nlayers'], enable_nested_tensor=False)
        self.decoder = scope['ExprDecoder'](d)
    def forward(self, src, values, mask):
        x = self.encoder(src) + self.value_encoder(values)
        x = self.transformer_encoder(x, src_key_padding_mask=mask)
        return self.decoder(x)['pred']

def main():
    OUT.mkdir(exist_ok=True, parents=True)
    vocab=json.loads((CKPT/'vocab.json').read_text()); cfg=json.loads((CKPT/'args.json').read_text())
    model=Reconstruction(vocab,cfg).eval()
    state=torch.load(CKPT/'best_model.pt',map_location='cpu',weights_only=True)
    mapped={k.replace('.Wqkv.weight','.in_proj_weight').replace('.Wqkv.bias','.in_proj_bias'):v for k,v in state.items()}
    expected=model.state_dict()
    # Every tensor used by this inference path must exist with the exact shape.
    for k,v in expected.items():
        assert k in mapped and mapped[k].shape == v.shape, k
    model.load_state_dict({k:mapped[k] for k in expected},strict=True)
    excluded=[k for k in mapped if k not in expected]
    genes='TP53 MYC STAT1 BCL2 IL7R CD3D CD3E MS4A1 CD79A NKG7 GNLY LST1 S100A8 S100A9 FCGR3A LYZ MALAT1 ACTB GAPDH RPLP0 HLA-DRA CD14 GZMB PRF1 CCR7 TCF7 JUN FOS ISG15 IFIT1'.split()
    genes += [k for k,v in sorted(vocab.items(),key=lambda kv:kv[1]) if not k.startswith('<') and k not in genes][:128-len(genes)]
    ids=[vocab[g] for g in genes]
    rng=np.random.default_rng(42)
    values=rng.integers(0,51,(1,128)).astype('float32')
    inputs=(torch.tensor([ids]),torch.from_numpy(values),torch.zeros(1,128,dtype=torch.bool))
    path=OUT/'scgpt.onnx'
    with torch.no_grad():
        reference=model(*inputs).numpy()
        torch.onnx.export(model,inputs,str(path),input_names=['src','values','mask'],output_names=['predicted_expression'],opset_version=17,dynamo=False)
    onnx.checker.check_model(str(path))
    session=ort.InferenceSession(str(path),providers=['CPUExecutionProvider'])
    cases=[]
    for name,vals,mask in [('fixture',values,np.zeros((1,128),bool)),('masked',values,np.array([[False]*120+[True]*8])),('zeros',np.zeros((1,128),np.float32),np.zeros((1,128),bool)),('ablation',values.copy(),np.zeros((1,128),bool))]:
        if name=='ablation': vals[0,0]=0
        with torch.no_grad(): ref=model(inputs[0],torch.from_numpy(vals),torch.from_numpy(mask)).numpy()
        start=time.perf_counter(); actual=session.run(None,{'src':np.array([ids],np.int64),'values':vals,'mask':mask})[0]
        error=float(np.max(np.abs(ref-actual))); assert np.allclose(ref,actual,atol=2e-4,rtol=2e-4),(name,error)
        cases.append({'case':name,'max_abs_error':error,'latency_ms':(time.perf_counter()-start)*1000})
    fixture={'genes':genes,'src':ids,'values':values[0].tolist(),'mask':[False]*128,'expected':reference[0].tolist(),'description':'Seeded synthetic binned expression, not observed cells'}
    (OUT/'fixture.json').write_text(json.dumps(fixture))
    (OUT/'vocab.json').write_text(json.dumps(vocab))
    report={'task':'pretrained expression reconstruction; not perturbation prediction','sequence_length':128,'checkpoint':json.loads((CKPT/'revision.json').read_text()),'checkpoint_sha256':hashlib.sha256((CKPT/'best_model.pt').read_bytes()).hexdigest(),'onnx_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'onnx_bytes':path.stat().st_size,'loaded_tensors':len(expected),'excluded_tensors':excluded,'cases':cases,'torch':torch.__version__,'onnxruntime':ort.__version__,'upstream_revision':'cebd6fae655b9c585a4807daa3ac31bb764f06b4'}
    (OUT/'conversion-report.json').write_text(json.dumps(report,indent=2)); print(json.dumps(report,indent=2),flush=True)

if __name__=='__main__': main()
