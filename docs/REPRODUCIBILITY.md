# CellCast AI

A browser research workspace for real single-cell datasets, observed expression comparisons, measured perturbation responses, and local model inference. Built with Next.js, Bun, shadcn/ui, deck.gl, Recharts and TanStack Virtual.

## Run

```powershell
bun install --frozen-lockfile
bun run assets
bun run dev
```

Open http://127.0.0.1:3000.

## Research workflow

1. Open a real study in Dataset Explorer; plant studies are shown first. Filter by study type or verified perturbation support; perturbation studies sort first by default.
2. In Experiment Lab, choose **Experiment type**:
   - **Comparison:** compare measured gene expression between source populations.
   - **Perturbation response:** use real source control and treatment/genotype labels to inspect an observed intervention response.
3. Choose a suggested gene or search by name/identifier, choose the two groups and run the analysis. Inspect the published embedding, per-cell measurements, source links and result summary. Analyses are saved locally and can be reopened from Research History.

The app contains no simulated-expression demo mode. A public study is not automatically a perturbation dataset: perturbation mode requires an appropriate source metadata field and at least two usable conditions. No significance test or causal effect is implied by the descriptive mean difference.

Examples available from EMBL-EBI Single Cell Expression Atlas:

- `E-CURD-4`: Arabidopsis populations. Example genes `AT1G01010`, `AT3G18780`.
- `E-CURD-81`: rice root cells. Example gene `Os01g0100100`.
- `E-ENAD-30`: Arabidopsis `17beta-estradiol` treatment and `None` control, grouped by Compound.
- `E-GEOD-123013`: Arabidopsis wild type, `Rhd6 mutant` and `Gl2 mutant`, grouped by Genotype.
- `E-MTAB-6075`: human THP-1 cells, untreated/LPS/palmitate, grouped by Compound.

All source-derived coordinates, measurements and metadata retain source URLs. The explorer accesses a live catalogue; availability and counts can change upstream. Preview limits: 24 MB per upstream response, 150,000 plotted cells, 30-second request timeout. Larger studies remain accessible through their source downloads.

## Runnable models

Model Library loads weights and runs inference in a browser worker. Its Run model action loads the selected model automatically when necessary. WASM is the default; WebGPU is available under runtime details. A model session is unloaded when its worker is terminated; saved outputs are explicitly restored without pretending the runtime remains loaded.

| Model | Browser artifact | Task | Real inputs |
|---|---:|---|---|
| scPlantLLM Arabidopsis | 104.23 MB FP32 | 512-dimensional cell embedding | Three measured cells from E-CURD-4 |
| scGPT Human | 203.46 MB FP32 | Expression reconstruction | Three measured cells from E-MTAB-7606 |

These runs use explicitly shortened gene panels, binned and padded to 128 positions. They are engineering experiments, not validated full-transcriptome annotation pipelines or perturbation predictors. Plant-model CPU ONNX parity errors are below `3e-6` on the three measured inputs; initial browser measurements were approximately 166 ms and `3.1e-6` maximum error. Initial real-input scGPT browser measurements were approximately 295 ms and `2.3e-5` maximum error. Timing varies by device and runtime.

The scPlantLLM export retains the original Arabidopsis embedding vectors and removes unused species vocabulary rows, preserving the tested outputs exactly in PyTorch. All embedding-path tensors load strictly. Its upstream pre-norm residual ordering is preserved. Source code and checkpoint provenance, licenses, hashes, scope and reproducibility details are in [Model Library documentation](MODEL-LIBRARY.md).

CellOracle is listed as a future perturbation-simulation integration, not as an installed runnable model. Neither current model predicts the outcome of a previously unmeasured plant knockout or drug treatment. Observed perturbation analysis and predictive modeling are separate capabilities.

## Scrolling and browser storage

Navigation stays fixed while workspace content scrolls. Ordinary wheel gestures scroll over plots; plot zoom uses dedicated buttons. Each table has independent search, sorting, anchored zoom and horizontal/vertical scroll positions. Page positions restore after asynchronous content loads. See the [scroll contract](RESEARCH-UI.md).

Workspace preferences/history and model outputs use localStorage. Dataset previews and observed comparison data use IndexedDB. Table state uses separate keys; page scroll positions use sessionStorage. Clearing site data removes these records. The app requires its local Next.js server; complete offline reload is not supported. Public repository requests use a constrained same-origin proxy; model inference stays in the browser.

## Checks

```powershell
bun run build
bun run typecheck
bunx playwright install chromium
$env:CELLCAST_URL='http://127.0.0.1:3001'
bun scripts/research-e2e.mjs
```

The research replay covers real comparisons, chemical/genetic perturbation labels, invalid-gene recovery, dataset navigation, history, six real-cell model runs, exports, table/page state and four responsive widths. Evidence is stored in `docs/evidence`. Archived conversion-only diagnostics remain at `/verify.html`; these are separate from the researcher-facing app.

## Rebuild model assets

Model binaries and checkpoints are excluded from Git. A fresh clone must recreate them before running model inference:

```powershell
python -m venv .venv
.venv/Scripts/python -m pip install -r experiments/requirements.txt
.venv/Scripts/python experiments/download.py
.venv/Scripts/python experiments/export.py
.venv/Scripts/python experiments/verify_upstream.py
.venv/Scripts/python experiments/download_scplant.py
.venv/Scripts/python experiments/prepare_real_profiles.py
.venv/Scripts/python experiments/export_scplant.py
.venv/Scripts/python experiments/prepare_human_profiles.py
```

`export.py` retains a seeded numerical fixture for the original scGPT conversion diagnostic; it is not used in the main app. The app's model runs use the measured `*-real-profiles.json` inputs. Original scGPT INT8 experiments and raw measurements are retained as engineering evidence.

Sources: [Single Cell Expression Atlas](https://www.ebi.ac.uk/gxa/sc/home), [scPlantLLM](https://github.com/compbioNJU/scPlantLLM), [scGPT checkpoint](https://huggingface.co/perturblab/scgpt-human), [CellOracle](https://github.com/morris-lab/CellOracle).

