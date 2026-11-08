# Contributing to CellCast

Help make real single-cell research easier to inspect and reproduce. Useful contributions include dataset compatibility fixes, accessible scientific controls, performance improvements, clearer provenance, and reproducible model experiments.

## Start locally

1. Fork and clone the repository, then create a branch for your change.
2. Run `bun install --frozen-lockfile`, `bun run assets`, and `bun run dev`.
3. Read [AGENTS.md](AGENTS.md) and the relevant guides under `node_modules/next/dist/docs/` before editing application code. Follow the shared brand guidance in `AGENTS.md` for visual changes.
4. Prepare model weights only if your change needs inference; see the [reproduction guide](docs/REPRODUCIBILITY.md).

## Keep research claims inspectable

- Retain source study accessions, gene identifiers, units, and upstream URLs.
- Distinguish measured comparisons from model outputs. Descriptive differences do not establish statistical significance or causality.
- Record preprocessing, checkpoints, hashes, and numerical reference checks when changing model exports.
- Preserve upstream licenses. Do not commit checkpoints, ONNX weights, credentials, private data, or generated runtime dependencies.
- Reuse the [canonical CellCast assets and editable Pentool sources](design/README.md) for the app and documentation. Agents must follow the asset-use instructions in `AGENTS.md`.

## Before opening a pull request

Run `bun run typecheck` and `bun run build`. For changes to research workflows, run the relevant browser replay with the app and model assets available, and state which checks you actually completed. For UI changes, include screenshots at desktop and mobile widths.

Describe the problem, the resulting behavior, and how to verify it. Link any relevant study or issue. Keep changes focused, and flag any dependency or licensing changes. Contributions to original CellCast code are submitted under the repository's MIT license; third-party materials retain their existing terms.
