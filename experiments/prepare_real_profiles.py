"""Download measured expression from Atlas; build explicitly partial model panels."""
import concurrent.futures,json,pathlib,re,time
import requests,numpy as np
ROOT=pathlib.Path(__file__).resolve().parents[1];OUT=ROOT/'public/models'
BASE='https://www.ebi.ac.uk/gxa/sc/'
def download(url):
    r=requests.get(url,timeout=45);r.raise_for_status();return r
def panel(study,genes,vocab,kind,source_ids=None):
    html=download(BASE+'experiments/'+study).text
    match=re.search(r'content:\s*(\{[^\n]+\}),?\s*\n',html);config=json.loads(match[1])['tabs'][0]['props']
    defaults=config['defaultPlotMethodAndParameterisation'];method='UMAP' if 'UMAP' in defaults else next(iter(defaults));params={'plotMethod':method,**defaults[method]}
    def gene_data(g):
        try:
            source_gene=(source_ids or {}).get(g,g)
            url=requests.Request('GET',BASE+'json/cell-plots/'+study+'/expression/'+source_gene,params=params).prepare().url
            d=download(url).json()
            if 'min' not in d or 'max' not in d:raise ValueError('Gene not present in source study')
            rows=[p for s in d['series'] for p in s['data']];return g,rows,url,d.get('unit')
        except Exception as e:print('Skip',g,str(e)[:80],flush=True);return None
    with concurrent.futures.ThreadPoolExecutor(6) as executor:data=[d for d in executor.map(gene_data,genes) if d]
    assert len(data)>=8,'Too few source genes'
    genes=[d[0] for d in data];matrix={g:{r[2]:r[3] for r in rows} for g,rows,_,_ in data}
    cell_ids=[r[2] for r in data[0][1]]
    # Pick genuinely measured cells with the most nonzero genes in this panel.
    ranked=sorted(cell_ids,key=lambda c:sum(matrix[g].get(c,0)>0 for g in genes),reverse=True)[:3]
    all_values=[float(v) for _,rows,_,_ in data for *_,v in rows if v>0];lo=min(all_values);hi=max(all_values)
    bins=100 if kind=='scplant' else 50;edges=np.linspace(lo,hi,bins)
    profiles=[]
    for cell in ranked:
        observed=[float(matrix[g].get(cell,0)) for g in genes]
        binned=[int(np.digitize(v,edges)) if v>0 else 0 for v in observed]
        # Preserve absent expression as padding rather than inventing expression.
        active=[(g,v,o) for g,v,o in zip(genes,binned,observed) if v>0]
        src=[vocab['<cls>']] if kind=='scplant' else []
        values=[0] if kind=='scplant' else []
        kept=[]
        for g,v,o in active:src.append(vocab[g]);values.append(v);kept.append({'gene':g,'observed':o,'bin':v})
        mask=[False]*len(src);length=len(src)
        src.extend([vocab.get('<PAD>',vocab.get('<pad>',0))]*(128-length));values.extend(([101] if kind=='scplant' else [-2])*(128-length));mask.extend([True]*(128-length))
        profiles.append({'id':cell,'src':src,'values':values,'mask':mask,'genes':kept,'nonpadding':length})
    payload={'study':study,'species':'Arabidopsis thaliana' if kind=='scplant' else 'Homo sapiens','source':BASE+'experiments/'+study,'geneSources':[{'gene':g,'url':u} for g,_,u,_ in data],'unit':data[0][3],'panelGenes':genes,'binning':{'minNonzero':lo,'max':hi,'bins':bins,'scope':'Uniform bins across the measured source panel; exploratory adaptation, not a validated full-transcriptome preprocessing pipeline'},'description':'Measured repository cells, partial gene panel. No synthetic expression. Not a perturbation predictor.','profiles':profiles}
    (OUT/f'{kind}-real-profiles.json').write_text(json.dumps(payload,indent=2));print(kind,len(genes),[(p['id'],len(p['genes'])) for p in profiles],flush=True)
if __name__=='__main__':
    v=json.loads((ROOT/'experiments/scplant/gene_vocab.json').read_text())
    arab=[g for g in v if g.startswith('AT')];compact={'<PAD>':0,**{g:i+1 for i,g in enumerate(arab)},'<cls>':len(arab)+1}
    genes=['AT1G01010','AT3G18780','AT4G05320','AT5G12250','AT2G37620','AT1G13440','AT5G09810','AT3G53420']+arab[:24]
    panel('E-CURD-4',list(dict.fromkeys(genes)),compact,'scplant')
