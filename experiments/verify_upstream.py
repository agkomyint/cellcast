"""Independent comparison against historical upstream perceptual_forward."""
import ast, json, typing, warnings
import torch
from torch import nn, Tensor
from torch.nn import TransformerEncoder, TransformerEncoderLayer
import torch.nn.functional as F
from export import Reconstruction, ROOT, CKPT

scope={**vars(typing),'torch':torch,'nn':nn,'Tensor':Tensor,'F':F,'warnings':warnings,'TransformerEncoder':TransformerEncoder,'TransformerEncoderLayer':TransformerEncoderLayer}
tree=ast.parse((ROOT/'experiments/historical_model.py').read_text(encoding='utf-8-sig'))
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.ClassDef)],type_ignores=[]),'<upstream-4068d67>','exec'),scope)
cfg=json.loads((CKPT/'args.json').read_text());vocab=json.loads((CKPT/'vocab.json').read_text());f=json.loads((ROOT/'public/models/fixture.json').read_text())
original=scope['TransformerModel'](len(vocab),cfg['embsize'],cfg['nheads'],cfg['d_hid'],cfg['nlayers'],vocab=vocab,dropout=0,do_mvc=True,use_fast_transformer=False,use_generative_training=False).eval()
state=torch.load(CKPT/'best_model.pt',map_location='cpu',weights_only=True)
mapped={k.replace('.Wqkv.weight','.in_proj_weight').replace('.Wqkv.bias','.in_proj_bias'):v for k,v in state.items()}
original.load_state_dict(mapped,strict=True)
args=(torch.tensor([f['src']]),torch.tensor([f['values']]),torch.tensor([f['mask']]))
with torch.no_grad():
    actual=original(*args,generative_training=False)['mlm_output'][0]
error=float((actual-torch.tensor(f['expected'])).abs().max())
assert error<1e-5,error
p=ROOT/'public/models/conversion-report.json';report=json.loads(p.read_text());report['historical_upstream_parity']={'revision':'4068d67','path':'TransformerModel.perceptual_forward, standard attention','strict_full_checkpoint_load':True,'max_abs_error':error};p.write_text(json.dumps(report,indent=2));print(report['historical_upstream_parity'])
