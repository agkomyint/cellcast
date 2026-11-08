# Real datasets and the application frame

Dataset Explorer uses EMBL-EBI Single Cell Expression Atlas as an online source. It fetches the real catalogue, defaults to plants, and supports organism, kingdom and free-text filters. Each study includes accession, species, source cell count, platform, update date, original study and download links.

Opening a study fetches its published default UMAP or t-SNE coordinates and its author annotations when available. Otherwise, it uses source-computed clusters and labels them as such. No coordinates or missing cells are fabricated. The source catalogue count can differ from the source embedding count; both counts are shown.

The gene query uses source IDs (for example TAIR `AT1G01010`) and returns observed source-normalized expression, source units, minimum/maximum/mean, and expressing-cell counts. Expression is joined to the embedding by source cell ID, never by array position. Cell group distributions count the actual returned source points.

## UI implementation

- shadcn/ui components copied from the official registry: Button, Input, Card, Tabs, Select, NativeSelect, Badge, Skeleton, Table and ScrollArea. Radix provides accessible selectors and tabs; Tailwind supplies their styling.
- deck.gl ScatterplotLayer and OrthographicView render embeddings with GPU picking, tooltip details, click selection, pan, zoom and independent view state for each dataset. There is no SVG element per cell.
- Recharts renders inference control/treatment bars, with an accessible data layer and tooltips.
- TanStack Virtual renders only visible data-grid rows. Each table has its own search, sort order, zoom and scroll positions, stored separately in browser storage. Distribution, cell metadata, fixture genes and model-output tables never share these controls.
- The viewport is a fixed application frame. The workspace, study list and data tables have explicit scroll regions; body scrolling cannot move the top bar or desktop sidebar. On mobile, the compact navigation and top bar remain outside the scrolling content.

## Browser data and limits

Catalogue and explorer preferences are cached in localStorage. Real cell previews are cached in IndexedDB, with source URLs and retrieval timestamps. Cached data can remain visible if a refresh fails; the UI labels it and reports the error. Data retrieval uses a same-origin Next.js route to the fixed EMBL-EBI host, avoiding cross-origin browser restrictions. The route accepts only catalogued accession IDs and constrained gene IDs; it is not an arbitrary URL proxy.

Previews have a 24 MB upstream response cap, a 150,000-cell cap and a 30-second upstream timeout. Larger datasets remain discoverable and downloadable at the source. Full H5AD/Matrix Market parsing and arbitrary repository imports are not implemented. Selected real studies open in Experiment Lab for observed comparisons and treatment/genotype response analysis. The separate Model Library supports actual scPlantLLM Arabidopsis embeddings and scGPT Human reconstruction on recorded real source panels; arbitrary full-transcriptome inference is not implemented.

## Sources

- Catalogue: https://www.ebi.ac.uk/gxa/sc/json/experiments
- Atlas: https://www.ebi.ac.uk/gxa/sc/home
- Arabidopsis example: https://www.ebi.ac.uk/gxa/sc/experiments/E-CURD-4
- Rice example: https://www.ebi.ac.uk/gxa/sc/experiments/E-CURD-81
- Source cell-plot endpoints are exposed as links in the UI; no credentials are needed.

The Human scGPT checkpoint is not validated for plant genes. scPlantLLM supplies a plant embedding path. Neither runnable checkpoint is a validated plant perturbation predictor. The explicit Perturbation response mode uses observed source interventions and does not predict unmeasured outcomes.
