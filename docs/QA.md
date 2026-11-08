# Final research workflow verification

The production-build replay is `scripts/research-e2e.mjs`. Its latest complete result is recorded in `docs/evidence/research-e2e.json`.

- Seven real analyses passed: two Arabidopsis population comparisons, rice and Human comparisons, Arabidopsis estradiol versus untreated, Rhd6 mutant versus wild type, and Human LPS versus untreated.
- Experiment type is explicit. Source interventions use real Compound/Genotype labels; unsupported condition selections cannot run as perturbation tests.
- Unknown gene identifiers produced a clear error and recovered after entering a valid gene ID.
- Six browser WASM runs passed: all three measured cells for scPlantLLM and all three measured cells for scGPT. Worker parity checks passed; source IDs are attached to outputs.
- Model JSON export completed. Saved outputs restored without claiming that weights remain loaded. First-run loading automatically proceeds to inference.
- Table zoom did not leak between pages or between model input/output tables. Table zoom and scroll positions restored across navigation and reloads. Virtualization kept rendered rows below the full source row count.
- Ordinary wheel gestures over the plot scrolled the workspace. Top navigation stayed at y=0. Table boundaries allow scroll chaining to the workspace.
- Four pages were checked at 1440, 1280, 768 and 375 px widths: 16 page/viewport checks. No page horizontal overflow or window-body scrolling occurred. Screenshots were reviewed; workspace scrolling is intentional.
- Research History restored an actual saved comparison.
- No browser page errors were recorded in the complete replay.

Numeric conversion diagnostics remain in `public/models/conversion-report.json`, `public/models/scplant-report.json`, and earlier browser evidence. These establish computational parity, not biological validity. Observed treatment/genotype contrasts are descriptive; the app does not claim predictions of unseen perturbations.

Final gesture/lifecycle checks: native timed touch events over the production WebGL canvas moved workspace scrollTop from 400 to 585, with window scroll at 0 and mobile navigation unchanged. Immediate navigation after table zoom restored the exact scroll offset (655 before and after).

Beginner-flow regression: organism-scoped gene suggestions, ACT2 keyboard selection, duplicate-condition explanation and one-click untreated-control correction, result education, verified/genetic study filters, mobile layout and automatic genotype-mode setup all passed. The full replay passed again using the gene picker. Evidence: `guided-flow.json` and `study-classification.json`.
