"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import dynamic from "next/dynamic";

import {
  ArrowUpRight,
  Download,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Database,
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { GenePicker } from "@/components/gene-picker";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Badge } from "@/components/ui/badge";

import { Skeleton } from "@/components/ui/skeleton";

import { DataGrid } from "@/components/data-grid";

import { cacheDataset } from "@/lib/dataset-cache";

import { compareObserved, type ObservedRun } from "@/lib/observed";

import { cells, studies as atlasStudies, type CellData, type CellPoint, type Study } from "@/lib/atlas";

const Scatter = dynamic(() => import("@/components/cell-scatter"), {
  ssr: false,
  loading: () => <Skeleton className="h-80 w-full" />,
});

export function ObservedLab({
  studyId,
  onStudyChange,
  onBrowse,
  onComplete,
  restored,
}: {
  studyId: string;
  onStudyChange: (id: string) => void;
  onBrowse: () => void;
  onComplete: (r: ObservedRun) => void;
  restored?: ObservedRun;
}) {
  const [studies, setStudies] = useState<Study[]>([]),
    [data, setData] = useState<CellData>(),
    [expression, setExpression] = useState<CellData>(),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [gene, setGene] = useState("AT1G01010"),
    [groupA, setGroupA] = useState(""),
    [groupB, setGroupB] = useState(""),
    [result, setResult] = useState<ObservedRun>(),
    [activeTab, setActiveTab] = useState("summary");

  const [grouping, setGrouping] = useState("");
  const [experimentType, setExperimentType] = useState<
    "comparison" | "perturbation"
  >(
    ["E-ENAD-30", "E-MTAB-6075"].includes(studyId)
      ? "perturbation"
      : "comparison",
  );
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(`cellcast-lab-${studyId}`) || "{}",
      );
      if (typeof saved.grouping === "string") setGrouping(saved.grouping);
      if (["comparison", "perturbation"].includes(saved.experimentType))
        setExperimentType(saved.experimentType);
    } catch {}
  }, [studyId]);
  const requestId = useRef(0);
  const [picked, setPicked] = useState<CellPoint>();
  const [reloadVersion, setReloadVersion] = useState(0);
  const [errorTask, setErrorTask] = useState<"study" | "comparison">("study");
  const [dataNotice, setDataNotice] = useState("");
  const [expressionNotice, setExpressionNotice] = useState("");

  useEffect(() => {
    let active = true;
    atlasStudies().then(s => { if (active) setStudies(s); }).catch(e => { if (active) { setError(e.message); setErrorTask("study"); } });
    return () => { active = false; };
  }, [reloadVersion]);

  useEffect(() => {
    const controller = new AbortController();
    const id = ++requestId.current;
    setLoading(true);
    setBusy(false);
    setError("");
    setErrorTask("study");
    setDataNotice("");
    setExpressionNotice("");
    setData(undefined);
    setExpression(undefined);
    setResult(undefined);
    setPicked(undefined);

    const apply = (d: CellData) => {
      setData(d);
      const groups = d.groups.filter((g) => g.count > 0);
      let saved: {
        gene?: string;
        groupA?: string;
        groupB?: string;
        activeTab?: string;
      } = {};
      try {
        saved = JSON.parse(
          localStorage.getItem(`cellcast-lab-${studyId}`) || "{}",
        );
      } catch {}

      const control =
        /compound|genotype|stimulus|stress|phenotype|treatment/.test(
          d.grouping || "",
        )
          ? groups.find((g) =>
              /^(none|control|untreated|wild type genotype|wild[- ]type)$/i.test(
                g.name,
              ),
            )
          : undefined;
      const a = groups.some((g) => g.name === saved.groupA)
        ? saved.groupA!
        : control?.name || groups[0]?.name || "";
      const b =
        groups.some((g) => g.name === saved.groupB) && saved.groupB !== a
          ? saved.groupB!
          : groups.find((g) => g.name !== a)?.name || "";

      setActiveTab(saved.activeTab === "cells" ? "cells" : "summary");
      setGroupA(a);
      setGroupB(b);
      setGene(saved.gene || (studyId === "E-CURD-4" ? "AT1G01010" : ""));
    };

    let savedPreview: CellData | undefined;
    (async () => {
      try {
        const cached = (await cacheDataset(
          `${studyId}:${grouping || "default"}`,
        ).catch(() => undefined)) as CellData | undefined;
        if (id !== requestId.current) return;
        if (cached?.points?.length) {
          savedPreview = cached;
          apply(cached);
          setDataNotice("Showing saved cells while checking Atlas for an update.");
        }
        const fresh = await cells(studyId, undefined, grouping || undefined, controller.signal);
        if (id !== requestId.current) return;
        apply(fresh);
        setDataNotice("");
        await cacheDataset(`${studyId}:${grouping || "default"}`, fresh).catch(
          () => {},
        );
      } catch (e) {
        if (id === requestId.current && !controller.signal.aborted) {
          setError(e instanceof Error ? e.message : String(e));
          if (savedPreview) setDataNotice(`Atlas could not be refreshed. Showing saved cells retrieved ${new Date(savedPreview.retrievedAt).toLocaleString()}.`);
        }
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    })();

    return () => {
      controller.abort();
      requestId.current++;
    };
  }, [studyId, grouping, reloadVersion]);

  useEffect(() => {
    if (!data) return;
    try {
      localStorage.setItem(
        `cellcast-lab-${studyId}`,
        JSON.stringify({
          gene,
          groupA,
          groupB,
          activeTab,
          grouping,
          experimentType,
        }),
      );
    } catch {}
  }, [
    studyId,
    data,
    gene,
    groupA,
    groupB,
    activeTab,
    grouping,
    experimentType,
  ]);

  useEffect(() => {
    if (
      restored?.studyId === studyId &&
      (!restored.grouping || restored.grouping === data?.grouping)
    ) {
      setResult(restored);
      setGene(restored.gene);
      setGroupA(restored.a.group);
      setGroupB(restored.b.group);
    }
  }, [restored, studyId, data]);
  useEffect(() => {
    if (restored) {
      setGrouping(restored.grouping || "");
      setExperimentType(
        restored.task === "observed-perturbation"
          ? "perturbation"
          : "comparison",
      );
    }
  }, [restored]);

  useEffect(() => {
    if (!data || restored) return;
    let active = true;
    (async () => {
      const saved = (await cacheDataset(`analysis-result:${studyId}`).catch(
        () => undefined,
      )) as { result: ObservedRun; expression: CellData } | undefined;
      if (
        active &&
        saved?.result?.studyId === studyId &&
        saved.result.gene === gene &&
        saved.result.a.group === groupA &&
        saved.result.b.group === groupB &&
        saved.expression?.points?.length
      ) {
        setResult(saved.result);
        setExpression(saved.expression);
      }
    })();
    return () => {
      active = false;
    };
  }, [data, studyId, restored]);
  const perturbation = experimentType === "perturbation";
  const conditionOptions =
    data?.groupingOptions?.filter((g) =>
      /compound|genotype|stimulus|stress|phenotype|treatment/.test(g.value),
    ) || [];
  const validPerturbation =
    /compound|genotype|stimulus|stress|phenotype|treatment/.test(
      data?.grouping || "",
    );
  const sourceControl =
    perturbation && validPerturbation
      ? data?.groups.find(
          (g) =>
            g.count > 0 &&
            /^(none|control|untreated|wild type genotype|wild[- ]type)$/i.test(
              g.name,
            ),
        )
      : undefined;
  const sameGroups = !!groupA && groupA === groupB;
  const setupMessage =
    loading || busy || !data
      ? ""
      : perturbation && !validPerturbation
        ? "This selection has no treatment or genotype labels. Choose a perturbation label or another study."
        : !groupA || !groupB
          ? perturbation
            ? "Choose a control condition and a different perturbed condition to continue."
            : "Choose two different populations to continue."
          : sameGroups
            ? perturbation
              ? `Control and perturbed condition are both “${groupA}”. Choose different conditions to test a response.`
              : `Reference and comparison are both “${groupA}”. Choose different populations to compare expression.`
            : !gene.trim()
              ? "Enter a source gene ID to continue."
              : "";
  const study = studies.find((s) => s.id === studyId);
  const exampleGene = study?.species.startsWith("Arabidopsis")
    ? "AT1G01010"
    : study?.species === "Homo sapiens"
      ? "ENSG00000141510"
      : study?.species.includes("Japonica")
        ? "Os01g0100100"
        : undefined;

  useEffect(() => {
    if (study?.species.startsWith("Arabidopsis"))
      setGene((g) => g || "AT1G01010");
  }, [study]);

  const run = async () => {
    if (setupMessage) {
      setError(setupMessage);
      return;
    }
    if (!data || !study || !gene.trim()) return;
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setErrorTask("comparison");
    setExpressionNotice("");
    setResult(undefined);
    try {
      const saved = await cacheDataset(`expression:${studyId}:${gene.trim()}`).catch(() => undefined) as CellData | undefined;
      let observed: CellData;
      if (saved?.points?.length && Date.now() - Date.parse(saved.retrievedAt) < 3_600_000) {
        observed = saved;
        setExpressionNotice(`Using saved measured expression retrieved ${new Date(saved.retrievedAt).toLocaleString()}.`);
      } else {
        observed = await cells(studyId, gene.trim());
      }
      if (id !== requestId.current) return;

      const stats = compareObserved(data, observed, groupA, groupB);
      const r: ObservedRun = {
        id: crypto.randomUUID(),
        studyId,
        studyTitle: study.title,
        species: study.species,
        gene: gene.trim(),
        unit: observed.unit || "source units",
        ...stats,
        time: new Date().toISOString(),
        source: observed.source,
        grouping: data.grouping,
        task: perturbation ? "observed-perturbation" : "observed-comparison",
      };

      setExpression(observed);
      setResult(r);
      onComplete(r);
      await cacheDataset(
        `expression:${studyId}:${gene.trim()}`,
        observed,
      ).catch(() => {});
      await cacheDataset(`analysis-result:${studyId}`, {
        result: r,
        expression: observed,
      }).catch(() => {});
    } catch (e) {
      if (id === requestId.current)
        setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  };

  const points = useMemo(() => {
    if (!data) return [];
    if (!expression) return data.points;
    const values = new Map(expression.points.map((p) => [p.id, p.expression]));
    return data.points.map((p) => ({ ...p, expression: values.get(p.id) }));
  }, [data, expression]);

  const rows = useMemo(
    () =>
      points
        .filter((p) => p.group === groupA || p.group === groupB)
        .map((p) => ({
          cell: p.id,
          group: p.group,
          expression: p.expression ?? "Not loaded",
        })),
    [points, groupA, groupB],
  );

  const invalidate = () => {
    setResult(undefined);
    setExpression(undefined);
  };

  const exportResult = () => {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              analysis:
                "Observed group comparison; not causal perturbation prediction",
              ...result,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.studyId}-${result.gene}-comparison.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="research-workbench">
      <aside className="analysis-controls" aria-label="Analysis setup">
        <div className="control-heading">
          <SlidersHorizontal size={16} />
          <h2>Analysis setup</h2>
        </div>

        <label>
          Study
          <NativeSelect
            aria-label="Experiment dataset"
            value={studyId}
            disabled={loading || busy}
            onChange={(e) => onStudyChange(e.target.value)}
          >
            {!studies.length && (
              <NativeSelectOption value={studyId}>
                {studyId} — loading study
              </NativeSelectOption>
            )}
            {studies
              .filter((s) => s.kingdom === "plants" || s.id === studyId)
              .map((s) => (
                <NativeSelectOption value={s.id} key={s.id}>
                  {s.id} — {s.species}
                </NativeSelectOption>
              ))}
          </NativeSelect>
        </label>

        {study && (
          <div className="study-context">
            <span className="species">{study.species}</span>
            <p>{study.title}</p>
            <div>
              <span>{data?.points.length.toLocaleString() || "…"} cells</span>
              <a href={study.source} target="_blank" rel="noreferrer">
                Source
                <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        )}

        <Button variant="ghost" className="browse-study" onClick={onBrowse}>
          <Database size={14} />
          Change study
        </Button>

        <div className="control-divider" />
        <label>
          Experiment type
          <NativeSelect
            aria-label="Experiment type"
            value={experimentType}
            disabled={loading || busy}
            onChange={(e) => {
              const mode = e.target.value as "comparison" | "perturbation";
              setExperimentType(mode);
              invalidate();
              setGrouping(
                mode === "perturbation" ? conditionOptions[0]?.value || "" : "",
              );
            }}
          >
            <NativeSelectOption value="comparison">
              Comparison
            </NativeSelectOption>
            <NativeSelectOption value="perturbation">
              Perturbation response
            </NativeSelectOption>
          </NativeSelect>
        </label>
        <details className="experiment-guide">
          <summary>What does this experiment do?</summary>
          {perturbation ? (
            <>
              <p>
                A perturbation is an intervention, such as applying a compound
                or changing a gene. This test reads the study’s measured
                response.
              </p>
              <ol>
                <li>Choose the source label describing the intervention.</li>
                <li>Use an untreated or wild-type group as the control.</li>
                <li>
                  Choose a treated or mutant group, then enter the gene you want
                  to inspect.
                </li>
              </ol>
            </>
          ) : (
            <p>
              A comparison checks whether a gene is expressed differently in two
              cell populations. Choose one as the reference and another as the
              comparison.
            </p>
          )}
        </details>
        <label>
          {perturbation ? "Perturbation label" : "Group cells by"}
          <NativeSelect
            aria-label="Group cells by"
            value={grouping || data?.grouping || ""}
            disabled={loading || busy}
            onChange={(e) => {
              setGrouping(e.target.value);
              invalidate();
            }}
          >
            <NativeSelectOption value="">
              Source cell types / clusters
            </NativeSelectOption>
            {(perturbation ? conditionOptions : data?.groupingOptions)?.map(
              (g) => (
                <NativeSelectOption key={g.value} value={g.value}>
                  {g.label}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
        </label>
        {perturbation && (
          <p className="condition-help">
            {data?.grouping === "compound"
              ? "Compound means the chemical applied to the cells."
              : data?.grouping === "genotype"
                ? "Genotype identifies the genetic background, such as wild type or a mutant."
                : "Use the study’s intervention labels to identify control and perturbed groups."}
          </p>
        )}

        <label data-tour="gene">
          Gene
          <GenePicker
            studyId={studyId}
            value={gene}
            disabled={loading || busy}
            onChange={(id) => {
              setGene(id);
              invalidate();
            }}
          />
        </label>
        <div className="gene-guide">
          <p className="condition-help">
            Choose a suggested gene or search by name. Its source identifier is
            filled in for you.
          </p>
          {exampleGene && !gene.trim() && (
            <Button
              variant="outline"
              disabled={loading || busy}
              onClick={() => {
                setGene(exampleGene);
                invalidate();
              }}
            >
              Try {exampleGene}
            </Button>
          )}
        </div>

        <label data-tour="population">
          {perturbation ? "Control condition" : "Reference population"}
          <NativeSelect
            aria-label="Group A"
            aria-invalid={sameGroups || undefined}
            aria-describedby={
              sameGroups
                ? "analysis-setup-message"
                : perturbation
                  ? "control-condition-help"
                  : undefined
            }
            value={groupA}
            disabled={loading || busy}
            onChange={(e) => {
              setGroupA(e.target.value);
              invalidate();
            }}
          >
            {data?.groups
              .filter((g) => g.count > 0)
              .map((g) => (
                <NativeSelectOption key={g.name} value={g.name}>
                  {g.name} ({g.count.toLocaleString()})
                </NativeSelectOption>
              ))}
          </NativeSelect>
          {perturbation && (
            <small id="control-condition-help" className="condition-help">
              The reference group without the intervention.
              {data?.grouping === "compound" && sourceControl?.name === "None"
                ? " “None” means no compound was applied."
                : ""}
            </small>
          )}
        </label>

        <label>
          {perturbation ? "Perturbed condition" : "Comparison population"}
          <NativeSelect
            aria-label="Group B"
            aria-invalid={sameGroups || undefined}
            aria-describedby={
              sameGroups
                ? "analysis-setup-message"
                : perturbation
                  ? "perturbed-condition-help"
                  : undefined
            }
            value={groupB}
            disabled={loading || busy}
            onChange={(e) => {
              setGroupB(e.target.value);
              invalidate();
            }}
          >
            {data?.groups
              .filter((g) => g.count > 0)
              .map((g) => (
                <NativeSelectOption key={g.name} value={g.name}>
                  {g.name} ({g.count.toLocaleString()})
                </NativeSelectOption>
              ))}
          </NativeSelect>
          {perturbation && (
            <small id="perturbed-condition-help" className="condition-help">
              The group that received the treatment or carries the mutation.
            </small>
          )}
        </label>

        {setupMessage && (
          <div
            id="analysis-setup-message"
            className="setup-validation"
            role="alert"
          >
            <p>{setupMessage}</p>
            {sameGroups && sourceControl && sourceControl.name !== groupB && (
              <>
                <p>
                  Use “{sourceControl.name}” as the control and keep “{groupB}”
                  as the perturbed condition.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGroupA(sourceControl.name);
                    invalidate();
                  }}
                >
                  Use{" "}
                  {sourceControl.name === "None"
                    ? "untreated control"
                    : sourceControl.name}
                </Button>
              </>
            )}
          </div>
        )}
        {!setupMessage && !loading && !busy && data && (
          <p className="next-step" role="status">
            <b>Next step</b>Run {gene} for “{groupA}” and “{groupB}” to see the
            measured expression difference.
          </p>
        )}
        <Button
          className="analyze-button"
          aria-describedby={setupMessage ? "analysis-setup-message" : undefined}
          onClick={run}
          disabled={loading || busy || !data || !study || !!setupMessage}
        >
          <Play size={14} />
          {busy
            ? "Analyzing…"
            : perturbation
              ? "Test perturbation response"
              : "Compare expression"}
        </Button>

        {loading && (
          <p className="field-hint" role="status">
            Loading source cell populations…
          </p>
        )}

        {error && (
          <div className="repository-error" role="alert">
            {error}
            <Button variant="outline" disabled={loading || busy} onClick={() => errorTask === "comparison" ? run() : setReloadVersion(v => v + 1)}>
              {errorTask === "comparison" ? "Retry comparison" : "Retry study"}
            </Button>
            <a href={`https://www.ebi.ac.uk/gxa/sc/experiments/${studyId}`} target="_blank" rel="noreferrer">Open source study <ArrowUpRight size={12} /></a>
          </div>
        )}

        {perturbation &&
          (!conditionOptions.length ||
            data?.groups.filter((g) => g.count > 0).length === 1) &&
          !loading && (
            <div className="field-hint">
              Choose a study with two intervention conditions.
              <Button
                variant="outline"
                onClick={() => onStudyChange("E-ENAD-30")}
              >
                Open plant treatment study
              </Button>
            </div>
          )}
        <p className="analysis-note">
          {perturbation
            ? "Measured treatment/genotype groups. Not a prediction of a new outcome."
            : "Observed expression, not a simulated perturbation."}
        </p>
      </aside>

      <section className="analysis-canvas" aria-label="Analysis workspace">
        {(dataNotice || expressionNotice) && <p className="catalogue-note" role="status">{[dataNotice, expressionNotice].filter(Boolean).join(" ")}</p>}
        <div className="analysis-toolbar">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="summary">Cell landscape</TabsTrigger>
              <TabsTrigger value="cells">Cell table</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="analysis-toolbar-meta">
            {data && <span>{data.method}</span>}
            {result && (
              <Button variant="ghost" onClick={exportResult}>
                <Download size={14} />
                Export
              </Button>
            )}
          </div>
        </div>

        {loading && !data ? (
          <div className="analysis-placeholder">
            <Skeleton className="h-full w-full" />
          </div>
        ) : data && activeTab === "summary" ? (
          <>
            <div className="plot-caption">
              <div>
                <h2>{result ? result.gene : "Cell populations"}</h2>
                <span>
                  {result
                    ? `Observed expression (${result.unit})`
                    : data.colourBy}
                </span>
              </div>
              <Badge variant="outline">
                {data.points.length.toLocaleString()} cells
              </Badge>
            </div>
            <Scatter
              id={`lab-${studyId}`}
              key={studyId}
              points={points}
              expression={!!expression}
              onSelect={setPicked}
            />
            {picked && (
              <div className="picked-cell">
                <span>
                  {picked.group}
                  <small>{picked.id}</small>
                </span>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGroupA(picked.group);
                    invalidate();
                  }}
                >
                  Use as reference
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGroupB(picked.group);
                    invalidate();
                  }}
                >
                  Use as comparison
                </Button>
              </div>
            )}
            <div className="embedding-footer">
              <a href={data.source} target="_blank" rel="noreferrer">
                Source embedding
                <ArrowUpRight size={12} />
              </a>
              <span>Drag to pan · + / − to zoom</span>
            </div>
          </>
        ) : (
          data && (
            <div className="analysis-table">
              <p className="analysis-table-caption">
                Reference and comparison populations ·{" "}
                {rows.length.toLocaleString()} cells
              </p>
              <DataGrid
                id={`lab-cells-${studyId}`}
                key={studyId}
                title="Experiment cells"
                columns={[
                  { key: "cell", label: "Cell ID" },
                  { key: "group", label: "Population" },
                  {
                    key: "expression",
                    label: expression
                      ? `Expression (${expression.unit})`
                      : "Expression",
                  },
                ]}
                rows={rows}
              />
            </div>
          )
        )}

        {result ? (
          <div
            className="comparison-results"
            data-gene={result.gene}
            data-study={result.studyId}
          >
            <div className="comparison-heading">
              <div>
                <h2>
                  {perturbation
                    ? "Observed perturbation response"
                    : "Expression comparison"}
                </h2>
                <p>
                  {result.gene} <span className="quiet">/ {result.unit}</span>
                </p>
              </div>
              <span className="result-difference">
                {result.difference > 0 ? "+" : ""}
                {result.difference.toFixed(2)}
                <small>mean difference</small>
              </span>
            </div>
            <div className="comparison-detail">
              <div className="observed-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        group: perturbation ? "Control" : "Reference",
                        mean: result.a.mean,
                      },
                      {
                        group: perturbation ? "Perturbed" : "Comparison",
                        mean: result.b.mean,
                      },
                    ]}
                    layout="vertical"
                    margin={{ left: 0, right: 32, top: 8, bottom: 8 }}
                    accessibilityLayer
                  >
                    <CartesianGrid stroke="var(--border)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="group"
                      tick={{ fill: "var(--muted)", fontSize: 11 }}
                      width={90}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        color: "var(--text)",
                      }}
                    />
                    <Bar
                      dataKey="mean"
                      name={`Mean (${result.unit})`}
                      fill="var(--cyan)"
                      barSize={20}
                      radius={[0, 3, 3, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="population-stats">
                {[result.a, result.b].map((g, i) => (
                  <div key={i}>
                    <span>
                      {i === 0
                        ? perturbation
                          ? "Control"
                          : "Reference"
                        : perturbation
                          ? "Perturbed"
                          : "Comparison"}
                    </span>
                    <b title={g.group}>{g.group}</b>
                    <p>
                      {g.mean.toFixed(2)} {result.unit} mean <span>•</span>{" "}
                      {g.cells.toLocaleString()} cells
                    </p>
                    <p>{g.percentExpressing.toFixed(1)}% expressing</p>
                  </div>
                ))}
              </div>
            </div>
            <details className="result-guide">
              <summary>How do I read these results?</summary>
              <p>
                {result.gene} has {Math.abs(result.difference).toFixed(2)}{" "}
                {result.unit} {result.difference >= 0 ? "higher" : "lower"}{" "}
                average expression in the{" "}
                {perturbation ? "perturbed" : "comparison"} group than in the{" "}
                {perturbation ? "control" : "reference"} group.
              </p>
              <p>
                “Expressing” is the percentage of measured cells with a value
                above zero.
                {result.unit === "CPM"
                  ? " CPM means counts per million, which adjusts expression for sequencing depth."
                  : ""}
              </p>
              <p>
                These are descriptive group averages. They do not establish
                causality or statistical significance.
              </p>
            </details>
            <a
              className="source-link"
              href={result.source}
              target="_blank"
              rel="noreferrer"
            >
              Expression source
              <ArrowUpRight size={12} />
            </a>
          </div>
        ) : (
          <div className="analysis-empty">
            <span className="empty-plot-icon">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <h3>
                {perturbation
                  ? "How does this gene respond?"
                  : "Which populations express your gene?"}
              </h3>
              <p>
                Choose a gene and two populations, then compare their observed
                expression.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
