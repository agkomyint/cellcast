# Guided research tour

Open **Guided tour** in the workspace header, or choose **Start guided tour** from the first-visit invitation. The invitation is optional and can be dismissed with **Not now**.

The tour uses [Reactour](https://docs.reactour.dev/) (`@reactour/tour`) to highlight real controls. Nine lessons cover study discovery, provenance, cell landscapes, genes, population selection, running a measured comparison, interpreting evidence, model capabilities, and research history.

Users can interact with highlighted controls, including the gene picker. The comparison lesson enables Continue when a measured result appears; **Skip this experiment** handles unavailable data or users who only want an introduction. The tour never runs a model or downloads weights automatically, and it preserves the selected study and saved analyses.

**Save & exit**, Escape, the close button, or a click outside the spotlight pauses the tour. Progress is saved under `cellcast-learning-tour-v1` in localStorage. The header becomes **Resume tour**. Finish stores completion; the header then starts a new tour. Paused tours also offer **Restart from the beginning**. If browser storage is unavailable, the tour still works for the current session.

Implementation: `components/research-tour.tsx`. Lessons route to the appropriate workspace page and wait until their target is mounted. The tooltip uses viewport-bounded positioning and size observation. Gene-picker portals remain interactive above the mask. Arrow keys remain available to form controls; Escape pauses and focus returns to the header trigger. The tour uses no smooth scrolling or transition animation.

Verification against a production build:

```powershell
bun run build
bun run start --port 3003
# In another terminal:
$env:CELLCAST_URL='http://127.0.0.1:3003'
bun scripts/tour-e2e.mjs
```

The replay checks desktop, tablet, and mobile widths; Back/Continue; Escape and focus return; reload/resume; a real gene selection and measured comparison; experiment skipping; completion/restart; tooltip bounds; and browser errors. Evidence is recorded in `docs/evidence/tour-e2e.json` and `tour-*.png`.
