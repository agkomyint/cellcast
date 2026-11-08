# Vercel deployment

Production app: **https://cellcast-taupe.vercel.app**

The project is linked to `agkomyints-projects/cellcast` and the public GitHub repository. Deploy from the repository root with the authenticated Vercel CLI:

```sh
vercel link --yes --project cellcast
vercel deploy --prod --yes
```

`vercel.json` installs the frozen Bun lockfile, copies ONNX Runtime support files, downloads the two pinned browser exports, verifies their SHA-256 hashes, and builds Next.js. Deployment preparation fails if a download or hash check fails. No model-service API key is needed.

The browser exports are distributed in the [model-assets-v1 GitHub release](https://github.com/agkomyint/cellcast/releases/tag/model-assets-v1), with upstream license notices. They remain excluded from Git. `scripts/deployment-assets.ts` pins the release asset IDs and hashes and can also prepare local model files:

```sh
bun scripts/deployment-assets.ts
bun run assets
```

To regenerate rather than download the exports, follow [REPRODUCIBILITY.md](REPRODUCIBILITY.md). scPlantLLM-derived materials retain CC BY-NC 4.0; the app's MIT license does not replace those terms.

`.vercelignore` excludes local environments, checkpoints, native artwork, recorded screenshots, and generated binaries from CLI source uploads. Runtime files and browser weights are prepared during the build and served as static assets. Inference stays in the user's browser. Public Atlas data is fetched by the Next.js routes.

The app uses Vercel's production-origin environment variable for absolute social-image URLs. `CELLCAST_PUBLIC_URL` can override that origin when using a custom domain. Never commit `.vercel` or credentials.
