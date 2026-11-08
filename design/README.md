# CellCast brand kit

Created and exported with **Pentool CLI** (`pentool.exe`). Native `.pen` sources in this directory retain editable shapes, paths, and text. SVG text is outlined for portable rendering; PNGs are ready to use.

| Asset | Use | Export |
|---|---|---|
| Cell mark | App navigation, favicon, avatar | [SVG](../public/brand/cellcast-mark.svg) / [PNG](../public/brand/cellcast-mark.png) |
| Wordmark | Wide brand lockups | [SVG](../public/brand/cellcast-wordmark.svg) / [PNG](../public/brand/cellcast-wordmark.png) |
| Banner | GitHub README, 1600 × 740 | [SVG](../public/brand/cellcast-banner.svg) / [PNG](../public/brand/cellcast-banner.png) |
| Social card | Link previews, 1200 × 630 | [SVG](../public/brand/cellcast-social.svg) / [PNG](../public/brand/cellcast-social.png) |
| Workflow | Project explanation, 1440 × 400 | [SVG](../public/brand/cellcast-workflow.svg) / [PNG](../public/brand/cellcast-workflow.png) |

The open C silhouette represents a cell; a nucleus-to-output line suggests an inspectable computation. Mint, lilac, and sand match the existing research workspace. The population motif is abstract illustration, not an experimental result. App screenshots live in `docs/evidence/` and must be labeled separately from illustrations.

Use the mark on its charcoal background. Maintain at least 16% of its width as surrounding space. Do not stretch, rotate, recolor, add shadows, or replace it with a generic DNA icon. Prefer the mark below 48px; keep the wordmark large enough to read. Palette values are in [tokens.json](tokens.json).

## Edit and export

```powershell
pentool.exe info design/cellcast-mark.pen
pentool.exe tree design/cellcast-mark.pen
pentool.exe export design/cellcast-mark.pen public/brand/cellcast-mark.svg --outline-text
pentool.exe export design/cellcast-mark.pen public/brand/cellcast-mark.png
pentool.exe export design/cellcast-social.pen app/opengraph-image.png
```

After changing the mark, copy the SVG export to `app/icon.svg`. After changing the social card, refresh `app/opengraph-image.png`. Inspect PNG exports before committing. Use `pentool.exe <command> --help` for installed-version syntax.

[scripts/brand-assets.py](../scripts/brand-assets.py) is the deterministic original creation recipe. It uses Pentool for every drawing and export operation and refuses to overwrite existing designs. To rebuild, first move existing `.pen` files into a separate backup directory. No AI image service or API key is needed.

Original CellCast artwork is covered by the root MIT license. Upstream scientific data, model weights, and third-party source retain their own licenses.

When deploying, set `CELLCAST_PUBLIC_URL` to the site's HTTPS origin before building so social image URLs point to that deployment. Local development defaults to `http://localhost:3000`.
