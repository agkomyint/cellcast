# Research workflow and scrolling

Design skill installed: `research-ui-design`, from Anthropic's `skills/frontend-design`. Its guidance is applied to the subject's actual workflow rather than adding decorative dashboard chrome.

The lab has one workbench: setup on the left, observed cells and comparison on the right. Source study, gene and reference/comparison populations are the primary inputs. Clicking a plotted cell exposes its real source annotation and lets the researcher assign its population as reference or comparison.

The study browser is a searchable, sortable, virtualized catalogue. The model library has species/task choices and a single Run model action; weights load automatically when needed. Runtime configuration and input measurements are available under expandable details. Saved model outputs restore without claiming that weights remain loaded.

## Scroll contract

- The navigation frame stays fixed. The main workspace has its own visible scrollbar.
- Each page remembers its vertical position in sessionStorage. Restoration waits for asynchronously loaded content and stops if the user scrolls or interacts.
- Each data grid has independent search, sort, zoom and horizontal/vertical scroll positions in localStorage. Zoom retains the approximate visible row instead of returning to the top.
- Plot wheel capture is disabled. Ordinary mouse-wheel gestures scroll the workspace, including over the canvas. Plot zoom uses its own buttons; mouse dragging pans.
- On coarse-pointer devices, plot drag-pan is disabled and vertical touch gestures remain available to the page.
- At a table boundary, ordinary scrolling can continue into the surrounding workspace. Table scrolling does not move the top navigation.

End-to-end checks cover real plant comparisons, invalid-gene recovery, study opening, all three measured cells for both runnable models, output/input tables, exports, history reopening, page-state restoration, and responsive layouts. The browser evidence directory records measured results and screenshots; tests must be rerun after relevant changes.

The complete replay passed seven real analyses, six model runs and 16 page/viewport checks. The final table lifecycle check restored the exact offset after zoom and immediate navigation. Deck wrapper touch actions are explicitly overridden so native touch scrolling is not blocked by a WebGL ancestor.

Experiment type is explicit: Comparison uses reference/comparison populations; Perturbation response uses source control and treated/mutant conditions. The action and result labels follow that selection. This is observed response analysis, not a forecast of an unmeasured intervention.

## Beginner guidance and discovery

The lab shows the reason for a blocked action. Duplicate control/treatment selections are highlighted and linked to a plain-language explanation; known untreated controls have a one-click correction. Contextual help defines experiment types, source labels, control and perturbed groups, and result interpretation. Ready-state guidance suggests the next action.

Genes use a searchable, keyboard-accessible picker. Default suggestions include source-resolved names such as NAC001, ACT2, UBQ10 and TP53, with stable identifiers. Suggestions are organism-scoped; measured expression availability is verified at run time, not assumed from a genome-wide suggestion.

Dataset Explorer classifies studies by chemical, genetic, stress/stimulus or atlas metadata, offers filters, and defaults to perturbations first. Verified intervention studies are limited to condition groups actually retrieved and tested: E-ENAD-30, E-GEOD-123013 and E-MTAB-6075. Candidate metadata is labeled separately. Opening a verified perturbation-filter result preselects the appropriate perturbation mode and grouping.
