"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Tour, type StepType } from "@reactour/tour";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE = "cellcast-learning-tour-v1";
const lessons = [
  { section: "Dataset Explorer", selector: ".catalogue-filters", title: "Start with a real study", chapter: "Discover", description: "A study records cells from a specific organism and experiment. Use the filters to explore plants or humans, and check the source before interpreting a result.", task: "Look at the organism and study-type filters. Next, we’ll return to your selected study." },
  { section: "Experiment Lab", selector: '[aria-label="Experiment dataset"]', title: "Know where the cells came from", chapter: "Discover", description: "The study accession links your analysis to its published data. Species, tissue, and experimental conditions give every cell its biological context.", task: "Read the study name and its source link. Your current study stays selected during this tour." },
  { section: "Experiment Lab", selector: ".analysis-toolbar", title: "Read the cell landscape", chapter: "Understand", description: "Each dot in the landscape represents a measured cell. Nearby dots have similar expression profiles in a reduced-dimensional view. Distance alone does not prove shared function or ancestry.", task: "Use Cell landscape to see the map, or Cell table to inspect individual records." },
  { section: "Experiment Lab", selector: '[data-tour="gene"]', title: "Ask about a gene", chapter: "Understand", description: "Gene expression measures detected RNA, a clue to which genes a cell is using. It is not a direct measurement of protein activity. Gene identifiers depend on the organism.", task: "Choose a suggested gene, or keep the current one. For Arabidopsis, ACT2 / AT3G18780 is a useful starting example." },
  { section: "Experiment Lab", selector: '[data-tour="population"]', title: "Choose a fair comparison", chapter: "Compare", description: "A population is a group of cells with a shared label. Compare two different populations. For a perturbation study, inspect Experiment type and use real control and treatment labels.", task: "Check the reference and comparison groups. Differences can reflect cell identity, experimental conditions, or other factors." },
  { section: "Experiment Lab", selector: ".analyze-button", title: "Run your first comparison", chapter: "Compare", description: "CellCast retrieves measured expression for your gene and summarizes the two groups. This step uses published measurements; it is not an AI prediction.", task: "Press Compare expression (or Test perturbation response) in the highlighted control. Continue becomes available when a result appears." },
  { section: "Experiment Lab", selector: ".comparison-results, .analysis-empty", title: "Read the evidence carefully", chapter: "Interpret", description: "Compare mean expression, the number of cells, and the fraction with detected expression. A mean difference describes this dataset; it does not establish statistical significance or a causal effect.", task: "If you ran a comparison, expand “How do I read these results?” and follow Expression source. Otherwise, return to this lesson after your first run." },
  { section: "Model Library", selector: ".model-choices", title: "Understand what the models do", chapter: "Explore", description: "scPlantLLM creates a cell embedding: a numeric representation. scGPT reconstructs expression. These short-panel examples are exploratory; neither model predicts an unseen knockout or drug response.", task: "Model runs download large weights. You can explore the model descriptions now without downloading anything." },
  { section: "Research History", selector: 'main[aria-label="Research History"]', title: "Keep a research trail", chapter: "Reflect", description: "History lets you reopen measured comparisons saved in this browser. Record the study, gene, groups, result, and a limitation so someone else can understand your reasoning.", task: "Your next question: what additional evidence would help explain the difference you observed? You can restart this tour from the header anytime." },
];

export function ResearchTour({ ready, onNavigate }: { ready: boolean; onNavigate: (section: string) => void }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [offer, setOffer] = useState(false);
  const [paused, setPaused] = useState(false);
  const [readyStep, setReadyStep] = useState(-1);
  const targetReady = readyStep === step;
  const [hasResult, setHasResult] = useState(false);
  const [disabledActions, setDisabledActions] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const lesson = lessons[step];

  useEffect(() => {
    if (!open) return;
    document.body.dataset.researchTour = "active";
    return () => { delete document.body.dataset.researchTour; };
  }, [open]);

  useEffect(() => {
    if (!open || !targetReady) return;
    // Reactour measures on window resize. Re-measure when live lesson text or fonts
    // change the popover's size, without animating through an offscreen position.
    const observer = new ResizeObserver(() => window.dispatchEvent(new Event("resize")));
    const frame = requestAnimationFrame(() => {
      const popover = document.querySelector(".research-tour-popover");
      if (popover) observer.observe(popover);
    });
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [open, targetReady, step, hasResult]);

  useEffect(() => {
    if (!ready) return;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (!saved) setOffer(true);
      if (saved?.status === "paused" && Number.isInteger(saved.step) && saved.step >= 0 && saved.step < lessons.length) {
        setStep(saved.step);
        setPaused(true);
      }
    } catch { setOffer(true); }
  }, [ready]);

  const save = (status: string, index = step) => {
    try { localStorage.setItem(STORAGE, JSON.stringify({ status, step: index })); } catch { /* Tour still works without storage. */ }
  };
  const close = (completed = false) => {
    setOpen(false);
    setReadyStep(-1);
    setPaused(!completed);
    save(completed ? "completed" : "paused");
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const start = (restart = false) => {
    if (restart || !paused) setStep(0);
    setOffer(false);
    setReadyStep(-1);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    setReadyStep(-1);
    onNavigate(lesson.section);
    save("paused");
    const inspect = () => {
      const correctSection = document.querySelector(`main[aria-label="${lesson.section}"]`);
      const target = correctSection?.querySelector(lesson.selector) ||
        (correctSection?.matches(lesson.selector) ? correctSection : null);
      setReadyStep(target ? step : -1);
      setHasResult(!!document.querySelector(".comparison-results"));
    };
    const observer = new MutationObserver(inspect);
    observer.observe(document.getElementById("workspace-content")!, { subtree: true, childList: true });
    const frame = requestAnimationFrame(inspect);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    // Navigation and observation follow the active lesson; storage is best effort.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step, onNavigate, lesson]);

  const steps: StepType[] = lessons.map(item => ({ selector: item.selector, content: item.description, mutationObservables: ["#workspace-content"] }));
  return <>
    <Button ref={trigger} variant="ghost" className="tour-trigger" onClick={() => start()} disabled={!ready}>
      <BookOpen size={15} /><span>{paused ? "Resume tour" : "Guided tour"}</span>
    </Button>
    {offer && !open && <div className="tour-invitation" role="region" aria-label="Learn CellCast">
      <BookOpen size={19} />
      <div><strong>Learn while you research</strong><p>A guided introduction to cells, genes, and your first comparison.</p></div>
      <Button onClick={() => start()}>Start guided tour</Button>
      <Button variant="ghost" onClick={() => { setOffer(false); save("dismissed", 0); }}>Not now</Button>
    </div>}
    {open && targetReady && createPortal(<Tour
      isOpen={open} setIsOpen={() => close()} currentStep={step} setCurrentStep={setStep}
      steps={steps} disabledActions={disabledActions} setDisabledActions={setDisabledActions}
      disableKeyboardNavigation={["left", "right"]} disableFocusLock disableInteraction={false}
      scrollSmooth={false} onClickMask={() => close()} onClickClose={() => close()}
      afterOpen={() => document.getElementById("research-tour-title")?.focus({ preventScroll: true })}
      className="research-tour-popover" padding={{ mask: 7, popover: 14 }}
      position={({ width, height, windowWidth, windowHeight, left, right, top, bottom }) => {
        const clampX = (x: number) => Math.max(12, Math.min(x, windowWidth - width - 12));
        const clampY = (y: number) => Math.max(12, Math.min(y, windowHeight - height - 12));
        if (windowWidth - right > width + 24) return [clampX(right + 12), clampY(top)];
        if (left > width + 24) return [clampX(left - width - 12), clampY(top)];
        if (windowHeight - bottom > height + 24) return [clampX(left), clampY(bottom + 12)];
        if (top > height + 24) return [clampX(left), clampY(top - height - 12)];
        return [clampX((windowWidth - width) / 2), clampY(windowHeight - height - 12)];
      }}
      accessibilityOptions={{ ariaLabelledBy: "research-tour-title", closeButtonAriaLabel: "Pause guided tour", showNavigationScreenReaders: true }}
      styles={{
        popover: (base, state) => ({ ...base, opacity: state?.helperRect?.width ? 1 : 0, transition: "none", background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 10, padding: 22, width: 340, maxWidth: "calc(100vw - 24px)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", boxShadow: "0 16px 56px #0006", zIndex: 10001 }),
        maskWrapper: base => ({ ...base, color: "#000", opacity: .65, zIndex: 10000 }),
      }}
      ContentComponent={() => <div role="dialog" aria-modal="false" aria-labelledby="research-tour-title">
        <div className="tour-heading"><span>{lesson.chapter} · {step + 1} of {lessons.length}</span><button aria-label="Pause guided tour" onClick={() => close()}><X size={17} /></button></div>
        <progress aria-label="Tour progress" value={step + 1} max={lessons.length} />
        <h2 id="research-tour-title" tabIndex={-1}>{lesson.title}</h2>
        <p>{lesson.description}</p>
        <div className="tour-task"><strong>Try it</strong><p>{lesson.task}</p></div>
        {step === 5 && <p className="tour-result-status" role="status">{hasResult ? "Your measured result is ready. Continue to interpret it." : "Waiting for a comparison. If data is unavailable, you can skip this experiment."}</p>}
        <div className="tour-actions">
          <Button variant="ghost" onClick={() => close()}>Save & exit</Button>
          <div><Button variant="outline" disabled={step === 0} onClick={() => setStep(s => s - 1)}>Back</Button>
          <Button disabled={step === 5 && !hasResult} onClick={() => step === lessons.length - 1 ? close(true) : setStep(s => s + 1)}>{step === lessons.length - 1 ? "Finish tour" : "Continue"}</Button></div>
        </div>
        {step === 5 && !hasResult && <button className="tour-skip" onClick={() => setStep(s => s + 1)}>Skip this experiment</button>}
        {paused && step > 0 && <button className="tour-skip" onClick={() => setStep(0)}>Restart from the beginning</button>}
      </div>}
    />, document.body)}
  </>;
}
