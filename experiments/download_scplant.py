"""Fetch pinned public upstream files and verify the real plant checkpoint."""
import hashlib,json,pathlib,requests
ROOT=pathlib.Path(__file__).resolve().parents[1];P=ROOT/'experiments/scplant';P.mkdir(exist_ok=True)
REV='0bc369cf519b37c5c116f425e4e2fa7f769c8528'
for name in ['scplantllm/model.py','gene_vocab.json','celltype_vocab.json','setting.json','LICENSE']:
    r=requests.get(f'https://raw.githubusercontent.com/compbioNJU/scPlantLLM/{REV}/{name}',timeout=60);r.raise_for_status();(P/pathlib.Path(name).name).write_bytes(r.content)
checkpoint=P/'checkpoint.pth';expected='baa24dc1e686b94aa08e7e7b08df17e1bb53e479416acf7f50cd032b0fabf416'
if not checkpoint.exists() or hashlib.sha256(checkpoint.read_bytes()).hexdigest()!=expected:
    r=requests.get(f'https://media.githubusercontent.com/media/compbioNJU/scPlantLLM/{REV}/model_params/scPlantLLM_model.pth',stream=True,timeout=120);r.raise_for_status()
    with checkpoint.open('wb') as f:
        for chunk in r.iter_content(1024*1024):f.write(chunk)
assert hashlib.sha256(checkpoint.read_bytes()).hexdigest()==expected
(P/'revision.json').write_text(json.dumps({'repository':'compbioNJU/scPlantLLM','revision':REV}))
print('Pinned scPlantLLM source and checkpoint ready')
