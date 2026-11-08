"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ArrowRight, RefreshCw, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { DataGrid } from "@/components/data-grid";
import { Skeleton } from "@/components/ui/skeleton";
import type { Study } from "@/lib/atlas";
import { studyDesign } from "@/lib/study-design";
export function DatasetExplorer({
  onUseStudy,
}: {
  onUseStudy?: (s: Study) => void;
}) {
  const [studies, setStudies] = useState<Study[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [kingdom, setKingdom] = useState("plants"),
    [species, setSpecies] = useState("all"),
    [support, setSupport] = useState("all"),
    [order, setOrder] = useState("perturbation"),
    [ready, setReady] = useState(false),
    [cached, setCached] = useState(false);
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/datasets?refresh=1");
      const payload = await response.json();
      if (!response.ok) throw Error(payload.error || "Repository unavailable");
      setStudies(payload.studies);
      setCached(false);
      try {
        localStorage.setItem(
          "cellcast-atlas-catalogue",
          JSON.stringify(payload),
        );
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      try {
        const saved = JSON.parse(
          localStorage.getItem("cellcast-atlas-catalogue") || "null",
        );
        if (Array.isArray(saved?.studies)) {
          setStudies(saved.studies);
          setCached(true);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("cellcast-study-filters") || "{}",
      );
      if (["plants", "animals", "all"].includes(saved.kingdom))
        setKingdom(saved.kingdom);
      if (typeof saved.species === "string") setSpecies(saved.species);
      if (
        ["all", "verified", "chemical", "genetic", "stress", "atlas"].includes(
          saved.support,
        )
      )
        setSupport(saved.support);
      if (["perturbation", "cells", "title"].includes(saved.order))
        setOrder(saved.order);
    } catch {}
    setReady(true);
    void load();
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "cellcast-study-filters",
          JSON.stringify({ kingdom, species, support, order }),
        );
      } catch {}
  }, [ready, kingdom, species, support, order]);
  const organisms = useMemo(
    () =>
      [
        ...new Set(
          studies
            .filter((s) => kingdom === "all" || s.kingdom === kingdom)
            .map((s) => s.species),
        ),
      ].sort(),
    [studies, kingdom],
  );
  const filtered = useMemo(
    () =>
      studies
        .filter(
          (s) =>
            (kingdom === "all" || s.kingdom === kingdom) &&
            (species === "all" || s.species === species) &&
            (support === "all" ||
              (support === "verified"
                ? studyDesign(s).verified
                : studyDesign(s).type === support)),
        )
        .sort((a, b) =>
          order === "cells"
            ? b.cells - a.cells
            : order === "title"
              ? a.title.localeCompare(b.title)
              : (studyDesign(a).verified
                  ? 0
                  : studyDesign(a).hasConditions
                    ? 1
                    : 2) -
                  (studyDesign(b).verified
                    ? 0
                    : studyDesign(b).hasConditions
                      ? 1
                      : 2) || a.title.localeCompare(b.title),
        ),
    [studies, kingdom, species, support, order],
  );
  const rows = useMemo(
    () =>
      filtered.map((s) => ({
        study: s.title,
        id: s.id,
        species: s.species,
        cells: s.cells,
        design: studyDesign(s).label,
        readiness: studyDesign(s).verified
          ? "Verified control / perturbation"
          : studyDesign(s).hasConditions
            ? "Check source conditions"
            : "Population comparison",
      })),
    [filtered],
  );
  const openStudy = (s: Study) => {
    if (support === "verified")
      try {
        const key = `cellcast-lab-${s.id}`;
        const saved = JSON.parse(localStorage.getItem(key) || "{}");
        localStorage.setItem(
          key,
          JSON.stringify({
            ...saved,
            experimentType: "perturbation",
            grouping:
              studyDesign(s).type === "genetic" ? "genotype" : "compound",
          }),
        );
      } catch {}
    onUseStudy?.(s);
  };
  return (
    <section className="study-catalogue">
      <div className="catalogue-header">
        <div className="catalogue-source">
          <span className="source-mark">
            <Leaf size={19} />
          </span>
          <div>
            <h2>Single Cell Expression Atlas</h2>
            <p>EMBL-EBI public repository</p>
          </div>
        </div>
        <Button variant="outline" disabled={loading} onClick={load}>
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>
      <div className="catalogue-filters">
        <label>
          Organisms
          <NativeSelect
            aria-label="Filter kingdom"
            value={kingdom}
            onChange={(e) => {
              setKingdom(e.target.value);
              setSpecies("all");
            }}
          >
            <NativeSelectOption value="plants">Plants</NativeSelectOption>
            <NativeSelectOption value="animals">Animals</NativeSelectOption>
            <NativeSelectOption value="all">All organisms</NativeSelectOption>
          </NativeSelect>
        </label>
        <label>
          Species
          <NativeSelect
            aria-label="Filter species"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          >
            <NativeSelectOption value="all">All species</NativeSelectOption>
            {organisms.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {s}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </label>
        <label>
          Study type
          <NativeSelect
            aria-label="Filter study type"
            value={support}
            onChange={(e) => setSupport(e.target.value)}
          >
            <NativeSelectOption value="all">All study types</NativeSelectOption>
            <NativeSelectOption value="verified">
              Verified perturbation studies
            </NativeSelectOption>
            <NativeSelectOption value="chemical">
              Chemical treatment
            </NativeSelectOption>
            <NativeSelectOption value="genetic">
              Genetic conditions / mutants
            </NativeSelectOption>
            <NativeSelectOption value="stress">
              Stress / stimulus
            </NativeSelectOption>
            <NativeSelectOption value="atlas">Cell atlases</NativeSelectOption>
          </NativeSelect>
        </label>
        <label>
          Sort by
          <NativeSelect
            aria-label="Sort studies"
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <NativeSelectOption value="perturbation">
              Perturbations first
            </NativeSelectOption>
            <NativeSelectOption value="cells">Most cells</NativeSelectOption>
            <NativeSelectOption value="title">Study title</NativeSelectOption>
          </NativeSelect>
        </label>
        <p>
          {loading
            ? "Fetching studies…"
            : `${filtered.length} studies${cached ? " · cached catalogue" : ""}`}
          <br />
          <a
            href="https://www.ebi.ac.uk/gxa/sc/home"
            target="_blank"
            rel="noreferrer"
          >
            Visit repository
            <ArrowUpRight size={12} />
          </a>
        </p>
      </div>
      {error && (
        <div className="repository-error" role="alert">
          {error}
          {cached ? " Your cached catalogue is available." : ""}
          <Button variant="outline" onClick={load}>
            Try again
          </Button>
        </div>
      )}
      {loading && !studies.length ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <DataGrid
          id="repository-studies"
          title="Studies"
          rowHeight={70}
          columns={[
            {
              key: "study",
              label: "Study",
              render: (r) => (
                <div className="study-name">
                  <strong>{r.study}</strong>
                  <small>{r.id}</small>
                </div>
              ),
            },
            { key: "species", label: "Species" },
            {
              key: "design",
              label: "Study type",
              render: (r) => (
                <div className="study-design">
                  <b>{r.design}</b>
                  <small
                    className={
                      String(r.readiness).startsWith("Verified")
                        ? "verified"
                        : ""
                    }
                  >
                    {r.readiness}
                  </small>
                </div>
              ),
            },
            {
              key: "cells",
              label: "Cells",
              render: (r) => Number(r.cells).toLocaleString(),
            },
            {
              key: "id",
              label: "Open",
              render: (r) => (
                <Button
                  variant="outline"
                  onClick={() => {
                    const s = studies.find((s) => s.id === r.id);
                    if (s) openStudy(s);
                  }}
                >
                  Open study
                  <ArrowRight size={13} />
                </Button>
              ),
            },
          ]}
          rows={rows}
        />
      )}
      <p className="catalogue-note">
        “Verified” means we retrieved and tested its control/perturbed groups.
        Other categories describe repository metadata; usable conditions are
        checked when you open the study.
      </p>
    </section>
  );
}
