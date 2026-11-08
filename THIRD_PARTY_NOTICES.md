# Third-party notices

The root MIT license covers original CellCast code and original CellCast assets. It does not replace licenses attached to upstream source, model checkpoints, model-derived exports, datasets, fonts, or dependencies.

| Material | Location / source | Terms and attribution |
| --- | --- | --- |
| scPlantLLM source and supporting files | `experiments/scplant/`; upstream revision recorded in `experiments/scplant/revision.json` | CC BY-NC 4.0. The full upstream license is retained in [experiments/scplant/LICENSE](experiments/scplant/LICENSE). Preserve attribution and observe its noncommercial restriction. |
| scPlantLLM checkpoint and derived browser export | Downloaded and generated locally by the experiment scripts | Subject to the upstream model's terms, including CC BY-NC 4.0; these artifacts are not relicensed under CellCast's MIT license. |
| scGPT source adaptations | Experiment code; [upstream scGPT](https://github.com/bowang-lab/scGPT) | The retained upstream MIT notice, copyright (c) 2022 suber, is in [experiments/SCGPT-LICENSE](experiments/SCGPT-LICENSE). |
| scGPT Human checkpoint and derived browser export | Downloaded from `perturblab/scgpt-human`; revision pinned in `experiments/download.py` | Consult the checkpoint repository's model card and terms as well as the retained source notice. CellCast's license does not grant additional checkpoint rights. |
| Single-cell measurements, coordinates, metadata, and measured model profiles | EMBL-EBI Single Cell Expression Atlas; source URLs recorded in the app and profile JSON | Credit the relevant study and original publication. Check each study's data terms; public availability does not imply that CellCast owns or relicenses the data. |
| Gene identifier mappings | Ensembl; mapping records in `experiments/human-gene-map.json` | Preserve source attribution and consult the upstream data terms when redistributing mappings. |
| JavaScript dependencies and bundled fonts | `package.json` and `bun.lock`; installed package license files | Each dependency retains its own license. Runtime support files copied into `public/ort/` are generated locally from ONNX Runtime Web and are excluded from Git. |

Model provenance, scope, checkpoint hashes, and adaptation details are documented in [docs/MODEL-LIBRARY.md](docs/MODEL-LIBRARY.md). CellOracle is referenced as a possible future integration; it is not currently bundled as an executable model.
