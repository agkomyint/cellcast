import json,torch
from prepare_real_profiles import panel,ROOT,OUT
from export import Reconstruction
mapping=json.loads((ROOT/'experiments/human-gene-map.json').read_text())
vocab=json.loads((ROOT/'experiments/checkpoint/vocab.json').read_text());config=json.loads((ROOT/'experiments/checkpoint/args.json').read_text())
source_ids={g:v['id'] for g,v in mapping.items() if g in vocab and v}
panel('E-MTAB-7606',list(source_ids),vocab,'scgpt',source_ids)
model=Reconstruction(vocab,config).eval()
state=torch.load(ROOT/'experiments/checkpoint/best_model.pt',map_location='cpu',weights_only=True);mapped={k.replace('.Wqkv.weight','.in_proj_weight').replace('.Wqkv.bias','.in_proj_bias'):v for k,v in state.items()};model.load_state_dict({k:mapped[k] for k in model.state_dict()},strict=True)
path=OUT/'scgpt-real-profiles.json';data=json.loads(path.read_text());data['geneMappingSource']='https://rest.ensembl.org/lookup/symbol/homo_sapiens'
for p in data['profiles']:
    with torch.no_grad():p['expected']=model(torch.tensor([p['src']]),torch.tensor([p['values']],dtype=torch.float32),torch.tensor([p['mask']]))[0].tolist()
path.write_text(json.dumps(data,indent=2));print('Human real profiles prepared with PyTorch references')
