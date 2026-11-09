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

Catalogue and explorer preferences are cached in localStorage. Real cell previews and measured expression are cached in IndexedDB, with source URLs and retrieval timestamps. Cached cells remain visible if a refresh fails; the UI labels them and reports the error. Repeated comparisons can reuse measured expression retrieved within the previous hour, with a saved-data label.

The browser fetches Atlas JSON directly: catalogue, gene suggestions, coordinates, and expression. These endpoints permit cross-origin browser access. Atlas HTML study pages do not, so `/api/datasets/[accession]/configuration` extracts just the plot configuration on the server. Successful configuration responses have a five-minute browser cache, one-hour CDN cache, and stale-while-revalidate window; upstream HTML is cached for one hour. Legacy dataset routes remain available for API consumers, but the researcher-facing app does not proxy measured cell data through Vercel.

Previews have a 24 MB upstream response cap and a 150,000-cell cap. Requests have a 45-second deadline covering headers and body, with one retry for a timeout, network failure, HTTP 429, or upstream 5xx. Missing resources and oversized responses are not retried. A bounded 16 MB / 128-entry in-memory cache reuses successful responses for up to an hour; concurrent identical requests share a download. Navigating away cancels that view's subscription without aborting other subscribers. Failed requests do not enter the cache. Explicit catalogue Refresh bypasses the cached catalogue. Errors offer Retry study / Retry comparison and a source link; they do not require a page reload.

Larger datasets remain discoverable and downloadable at the source. Full H5AD/Matrix Market parsing and arbitrary repository imports are not implemented. Selected real studies open in Experiment Lab for observed comparisons and treatment/genotype response analysis. The separate Model Library supports actual scPlantLLM Arabidopsis embeddings and scGPT Human reconstruction on recorded real source panels; arbitrary full-transcriptome inference is not implemented.

## Sources

- Catalogue: https://www.ebi.ac.uk/gxa/sc/json/experiments
- Atlas: https://www.ebi.ac.uk/gxa/sc/home
- Arabidopsis example: https://www.ebi.ac.uk/gxa/sc/experiments/E-CURD-4
- Rice example: https://www.ebi.ac.uk/gxa/sc/experiments/E-CURD-81
- Source cell-plot endpoints are exposed as links in the UI; no credentials are needed.

The Human scGPT checkpoint is not validated for plant genes. scPlantLLM supplies a plant embedding path. Neither runnable checkpoint is a validated plant perturbation predictor. The explicit Perturbation response mode uses observed source interventions and does not predict unmeasured outcomes.
