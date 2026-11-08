# Runnable model library

The app's Model Library has actual ONNX Runtime Web loading, inference and unloading in a browser worker. It supports WASM and opt-in WebGPU. Runtime state is never inferred from saved results; model weights reload after the library unmounts.

## scPlantLLM · Arabidopsis

- Source: https://github.com/compbioNJU/scPlantLLM, revision `0bc369cf519b37c5c116f425e4e2fa7f769c8528`.
- Checkpoint SHA-256: `baa24dc1e686b94aa08e7e7b08df17e1bb53e479416acf7f50cd032b0fabf416`.
- Original checkpoint: 431,801,156 bytes. Browser embedding export: 104,230,476 bytes.
- All 78 tensors used for embedding inference are loaded strictly. Unused reconstruction/classifier/discriminator heads are explicitly listed in the export report.
- The original multi-species vocabulary has 185,622 rows. The export retains exactly 32,250 rows: Arabidopsis genes plus padding and CLS. Gene IDs are remapped while their embedding vectors remain unchanged. Reduced-vocabulary PyTorch output matched original-vocabulary output exactly on three real profiles.
- The upstream pre-norm residual ordering is preserved; it is **not** equivalent to blindly setting `norm_first=True` in PyTorch. FlashMHA is replaced with PyTorch MultiheadAttention using the mapped Q/K/V weights and equivalent padding-mask polarity.
- Task: 512-dimensional cell embedding. No classification, biological confidence, knockout prediction, or drug response is claimed.
- Source license: CC BY-NC 4.0; upstream license is retained under `experiments/scplant/LICENSE`.

## scGPT Human

The existing 203,463,021-byte expression-reconstruction export remains runnable, now with measured Human source-cell inputs rather than synthetic fixture inputs. Source: https://huggingface.co/perturblab/scgpt-human. This checkpoint is not a plant model or a fine-tuned perturbation predictor.

## Real inputs and limits

Plant inputs come from Atlas study E-CURD-4; Human inputs come from E-MTAB-7606. The profile JSON records each cell ID, observed CPM, gene source URLs, model bins, binning range, and exact prepared token/value/mask arrays. Human symbols are mapped to source Ensembl IDs using the Ensembl lookup endpoint; the recorded mapping is in `experiments/human-gene-map.json`.

Profiles are deliberately short gene panels, not full transcriptomes. Plant profiles contain 31 queried genes, with 20–21 nonzero genes retained in each selected cell. Human profiles contain 25 queried genes. Positive expression is uniformly binned using the nonzero min/max over the measured panel, then unused sequence positions are padded to 128 with explicit masks. This is an exploratory adaptation of preprocessing, **not a validated full-transcriptome pipeline**.

PyTorch references on these same real inputs permit numerical conversion checks in the worker. A numerical mismatch above 0.001 causes output to be withheld. Numerical parity does not establish biological accuracy. The UI displays raw embeddings/reconstruction, not invented phenotype forecasts or clinical conclusions.

## Reproduce

After installing Python requirements and preparing the original scGPT export:

```powershell
.venv/Scripts/python experiments/download_scplant.py
.venv/Scripts/python experiments/prepare_real_profiles.py
.venv/Scripts/python experiments/export_scplant.py
.venv/Scripts/python experiments/prepare_human_profiles.py
bun run assets
bun run build
```

Profiles and numerical reports are tracked; large checkpoints and ONNX binaries are ignored by Git. The model files are already present in this working directory.

CellOracle is listed as a candidate only. No regulatory network has been fitted, no executable browser artifact is installed, and its UI does not pretend to load or run it.
