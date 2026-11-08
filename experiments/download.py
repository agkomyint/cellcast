import requests,json,pathlib
p=pathlib.Path('experiments/checkpoint');p.mkdir(exist_ok=True)
REVISION='571a0445d68fa48381f863ff75dd4f6d0eae3dfc'
meta=requests.get('https://huggingface.co/api/models/perturblab/scgpt-human/revision/'+REVISION,timeout=30).json()
print(meta.get('sha'),[s['rfilename'] for s in meta.get('siblings',[])])
for name in ['args.json','vocab.json','best_model.pt']:
 r=requests.get('https://huggingface.co/perturblab/scgpt-human/resolve/'+REVISION+'/'+name,stream=True,timeout=120);r.raise_for_status()
 with (p/name).open('wb') as f:
  for chunk in r.iter_content(1024*1024):f.write(chunk)
 print(name,(p/name).stat().st_size,flush=True)
(p/'revision.json').write_text(json.dumps({'repository':'perturblab/scgpt-human','revision':meta['sha']}))
