<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CellCast brand and research claims

- Read `design/README.md` before changing branding or creating visual artifacts.
- Use the canonical Pentool exports in `public/brand/`. Use `cellcast-mark.svg` for the app mark, `cellcast-wordmark.svg` for lockups, `cellcast-banner.png` for the GitHub README, and `cellcast-social.png` for sharing.
- Edit the native `.pen` files with `pentool.exe`, then export SVG and PNG. Preserve editable sources. `scripts/brand-assets.py` records the original build recipe; it refuses to overwrite existing sources.
- Reuse the palette in `design/tokens.json` and the app's existing Inter/JetBrains Mono typography. Keep scientific views legible; decorative cell motifs are illustrations, never measured embeddings.
- Preserve the distinction between measured population comparisons, observed perturbation responses, and experimental model inference. Neither runnable model predicts unmeasured knockout/drug outcomes. Do not invent accuracy, biological confidence, significance, or deployment claims.
- Keep upstream attribution and license exceptions in `THIRD_PARTY_NOTICES.md`; the root MIT license does not replace upstream model/data licenses.
