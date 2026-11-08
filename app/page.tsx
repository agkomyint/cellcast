"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Database,
  FlaskConical,
  History,
  Library,
  ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DatasetExplorer } from "@/components/dataset-explorer";
import { ObservedLab } from "@/components/observed-lab";
import { ModelLibrary } from "@/components/model-library";
import { usePageScroll } from "@/lib/use-page-scroll";
import type { ObservedRun } from "@/lib/observed";
const sections = [
  "Experiment Lab",
  "Dataset Explorer",
  "Model Library",
  "Research History",
];
const icons = [FlaskConical, Database, Library, History];
export default function Home() {
  const scrollPane = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState("Experiment Lab"),
    [studyId, setStudyId] = useState("E-CURD-4"),
    [history, setHistory] = useState<ObservedRun[]>([]),
    [restored, setRestored] = useState<ObservedRun>(),
    [ready, setReady] = useState(false),
    [storageError, setStorageError] = useState("");
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("cellcast-real-workspace") || "{}",
      );
      if (sections.includes(saved.section)) setSection(saved.section);
      if (/^E-[A-Z]+-\d+$/.test(saved.studyId)) setStudyId(saved.studyId);
      if (Array.isArray(saved.history))
        setHistory(
          saved.history
            .filter(
              (r: ObservedRun) =>
                r &&
                typeof r.id === "string" &&
                typeof r.gene === "string" &&
                typeof r.studyId === "string" &&
                Number.isFinite(r.a?.mean) &&
                Number.isFinite(r.b?.mean),
            )
            .slice(0, 20),
        );
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(
          "cellcast-real-workspace",
          JSON.stringify({ version: 1, section, studyId, history }),
        );
      } catch {
        setStorageError(
          "Browser storage is unavailable. Changes will last only for this session.",
        );
      }
  }, [ready, section, studyId, history]);
  usePageScroll(scrollPane, section);
  const selectStudy = (id: string) => {
    setStudyId(id);
    setRestored(undefined);
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <a href="/" className="brand">
          <Image src="/brand/cellcast-mark.svg" alt="" width={26} height={26} />
          CellCast<span className="brand-ai">AI</span>
        </a>
        <div className="workspace-label">Research workspace</div>
        <nav>
          {sections.map((s, i) => {
            const Icon = icons[i];
            return (
              <Button
                variant="ghost"
                key={s}
                className={`nav ${section === s ? "active" : ""}`}
                onClick={() => setSection(s)}
              >
                <Icon size={18} />
                {s}
              </Button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <a
            className="docs-link"
            href="https://www.ebi.ac.uk/gxa/sc/home"
            target="_blank"
            rel="noreferrer"
          >
            EMBL-EBI data source
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="breadcrumb">
            CellCast
            <ChevronRight size={14} />
            <strong>{section}</strong>
          </div>
          <div className="top-status">
            <span>
              <i className="dot" />
              Public study
            </span>
            <Button
              variant="outline"
              className="dataset-chip"
              onClick={() => setSection("Dataset Explorer")}
            >
              <Database size={14} />
              {studyId}
            </Button>
          </div>
        </header>
        <div
          ref={scrollPane}
          className="workspace-scroll"
          id="workspace-content"
          tabIndex={0}
          aria-label="Research workspace content"
        >
          <main aria-label={section}>
            {storageError && (
              <p role="alert" className="repository-error">
                {storageError}
              </p>
            )}
            {ready && section === "Experiment Lab" && (
              <ObservedLab
              key={studyId}
                studyId={studyId}
                onStudyChange={selectStudy}
                onBrowse={() => setSection("Dataset Explorer")}
                onComplete={(r) => setHistory((h) => [r, ...h].slice(0, 20))}
                restored={restored}
              />
            )}
            {ready && section === "Dataset Explorer" && (
              <DatasetExplorer
                onUseStudy={(s) => {
                  selectStudy(s.id);
                  setSection("Experiment Lab");
                }}
              />
            )}
            {section === "Model Library" && <ModelLibrary />}
            {section === "Research History" && (
              <Card>
                <CardHeader>
                  <CardTitle>Observed comparisons</CardTitle>
                </CardHeader>
                <CardContent>
                  {history.length ? (
                    <div className="history-list">
                      {history.map((h) => (
                        <div key={h.id}>
                          <FlaskConical size={18} />
                          <div>
                            <b>
                              {h.gene} · {h.species}
                            </b>
                            <p>
                              {h.studyId} · {new Date(h.time).toLocaleString()}
                            </p>
                            <p>
                              {h.a.group} vs. {h.b.group} · Δ{" "}
                              {h.difference.toFixed(3)} {h.unit}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setStudyId(h.studyId);
                              setRestored(h);
                              setSection("Experiment Lab");
                            }}
                          >
                            Reopen
                          </Button>
                        </div>
                      ))}
                      <Button variant="outline" onClick={() => setHistory([])}>
                        Clear history
                      </Button>
                    </div>
                  ) : (
                    <div className="empty">
                      <p>No comparisons yet.</p>
                      <Button onClick={() => setSection("Experiment Lab")}>
                        Open lab
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
