"""Build CellCast's editable brand kit with the installed Pentool CLI.

Run: python scripts/brand-assets.py (requires pentool.exe on PATH).
"""
from pathlib import Path
import math
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'design'
OUT = ROOT / 'public/brand'
SOURCE.mkdir(exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
PEN = shutil.which('pentool.exe') or shutil.which('pentool')
if not PEN:
    raise SystemExit('Install Pentool and add pentool.exe to PATH.')

def run(*args):
    result = subprocess.run([PEN, *map(str, args)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout)

def new(name, width, height):
    doc = SOURCE / f'{name}.pen'
    if doc.exists():
        raise SystemExit(f'{doc} exists. Move it aside before rebuilding to preserve edits.')
    run('new', doc, '--width', width, '--height', height, '--background', '#151a1e', '--name', name)
    run('layer', doc, 'add', 'art', '--name', 'CellCast artwork')
    return doc

def path(doc, name, d, color='#80c9bd', width=3, fill='none'):
    run('path', doc, 'put', name, '--layer', 'art', '--d', d, '--stroke', color,
        '--width', width, '--fill', fill, '--cap', 'round', '--join', 'round')

def circle(doc, name, x, y, radius, color):
    run('shape', doc, 'circle', name, '--layer', 'art', '--cx', x, '--cy', y,
        '--radius', radius, '--fill', color)

def text(doc, name, content, x, y, size, color='#e4e9ed', weight=400):
    run('text', doc, 'put', name, '--layer', 'art', '--content', content,
        '--x', x, '--y', y, '--font', 'Arial', '--size', size, '--weight', weight, '--fill', color)

def mark(doc, x, y, scale=1):
    def p(a,b): return f'{x+a*scale:.2f} {y+b*scale:.2f}'
    path(doc, 'cell-outline', f'M {p(91,30)} C {p(64,3)} {p(17,22)} {p(17,64)} C {p(17,106)} {p(64,125)} {p(91,98)}', width=10*scale)
    path(doc, 'cell-signal', f'M {p(53,64)} L {p(106,64)}', width=7*scale)
    circle(doc, 'cell-nucleus', x+53*scale, y+64*scale, 10*scale, '#80c9bd')
    circle(doc, 'cell-output', x+106*scale, y+64*scale, 6*scale, '#d5b98b')
    circle(doc, 'cell-satellite', x+87*scale, y+41*scale, 4*scale, '#b0a4d3')

def export(doc, name):
    for ext in ('svg', 'png'):
        args = ['export', doc, OUT / f'{name}.{ext}']
        if ext == 'svg': args.append('--outline-text')
        run(*args)
    print(f'Created {name}: .pen, .svg, .png', flush=True)

doc = new('cellcast-mark', 128, 128)
mark(doc, 0, 0)
export(doc, 'cellcast-mark')

doc = new('cellcast-wordmark', 560, 128)
mark(doc, 0, 0, .85)
text(doc, 'wordmark', 'CellCast', 124, 80, 62, weight=600)
text(doc, 'ai', 'AI', 403, 78, 25, '#80c9bd')
export(doc, 'cellcast-wordmark')

def cover(name, width, height):
    doc = new(name, width, height)
    s = width / 1600
    def t(id, content, x, y, size, color='#e4e9ed', weight=400):
        text(doc, id, content, x*s, y*s, size*s, color, weight)
    mark(doc, 72*s, 56*s, .65*s)
    t('brand', 'CellCast AI', 170, 116, 34, weight=600)
    t('eyebrow', 'A WORKSPACE FOR SINGLE-CELL RESEARCH', 88, 213, 16, '#80c9bd')
    t('headline-1', 'Real cells.', 82, 323, 90, weight=600)
    t('headline-2', 'Clearer questions.', 82, 425, 90, weight=600)
    t('description-1', 'Explore public studies. Compare measured responses.', 88, 501, 24, '#a6b1b9')
    t('description-2', 'Run single-cell models in your browser.', 88, 540, 24, '#a6b1b9')
    path(doc, 'divider', f'M {88*s} {620*s} L {1512*s} {620*s}', '#303940', 1)
    t('footer', 'OPEN SOURCE  /  REAL DATA  /  LOCAL INFERENCE', 88, 675, 16, '#a6b1b9')
    t('figure-label', 'ILLUSTRATIVE CELL POPULATIONS', 1090, 579, 12, '#a6b1b9')
    # A deterministic abstract population motif, explicitly not a scientific plot.
    for cluster, (cx, cy, color) in enumerate([(1190,290,'#80c9bd'),(1395,410,'#b0a4d3'),(1185,465,'#d5b98b')]):
        for i in range(35):
            a = i*2.399963
            r = math.sqrt((i+.5)/35)*85
            circle(doc, f'population-{cluster}-{i}', (cx+math.cos(a)*r)*s,
                   (cy+math.sin(a)*r*.76)*s, (2.5+(i%3)*.7)*s, color)
    export(doc, name)

cover('cellcast-banner',1600,740)
cover('cellcast-social',1200,630)

doc = new('cellcast-workflow', 1440, 400)
text(doc,'heading','From a public study to an inspectable result.',56,70,34,weight=600)
steps = [('01','Discover','Public Atlas studies'),('02','Compare','Measured expression'),('03','Run locally','Browser model inference'),('04','Inspect & export','Sources, outputs, history')]
for i,(number,title,caption) in enumerate(steps):
    x=56+i*350
    text(doc,f'number-{i}',number,x,145,19,'#80c9bd')
    text(doc,f'title-{i}',title,x,213,29,weight=600)
    text(doc,f'caption-{i}',caption,x,254,18,'#a6b1b9')
    path(doc,f'rule-{i}',f'M {x} 289 L {x+278} 289','#303940',2)
text(doc,'note','Observed comparisons and model outputs are distinct research workflows.',56,355,18,'#a6b1b9')
export(doc,'cellcast-workflow')
