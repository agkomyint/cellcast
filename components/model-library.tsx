"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ArrowUpRight, Cpu, Download, Play, Power } from "lucide-react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

import { DataGrid } from "@/components/data-grid";

type Profile = {
  id: string;
  src: number[];
  values: number[];
  mask: boolean[];
  expected?: number[];
  genes: { gene: string; observed: number; bin: number }[];
  nonpadding: number;
};

type Profiles = {
  study: string;
  species: string;
  source: string;
  unit: string;
  panelGenes: string[];
  description: string;
  profiles: Profile[];
  binning: { scope: string };
};

type Output = {
  values: number[];
  latencyMs: number;
  maxAbsError?: number;
  modelId: string;
  cell: string;
};

export function ModelLibrary() {
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [model, setModel] = useState("scplant"),
    [provider, setProvider] = useState("wasm"),
    [profiles, setProfiles] = useState<Profiles>(),
    [profileIndex, setProfileIndex] = useState("0"),
    [loaded, setLoaded] = useState(""),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("Choose a model and load its weights."),
    [error, setError] = useState(""),
    [output, setOutput] = useState<Output>(),
    [report, setReport] = useState<{ onnx_bytes: number }>();

  const worker = useRef<Worker | null>(null);

  const pendingRun = useRef<Profile | undefined>(undefined);
  useEffect(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem("cellcast-model-preferences") || "{}",
      );
      if (["scplant", "scgpt"].includes(p.model)) setModel(p.model);
      if (["wasm", "webgpu"].includes(p.provider)) setProvider(p.provider);
      if (["0", "1", "2"].includes(p.profileIndex))
        setProfileIndex(p.profileIndex);
    } catch {}
    setPreferencesReady(true);
  }, []);
  useEffect(() => {
    if (preferencesReady)
      try {
        localStorage.setItem(
          "cellcast-model-preferences",
          JSON.stringify({ model, provider, profileIndex }),
        );
      } catch {}
  }, [preferencesReady, model, provider, profileIndex]);

  useEffect(() => {
    const w = new Worker(new URL("../lib/model.worker.ts", import.meta.url));
    worker.current = w;
    w.onmessage = ({ data }) => {
      if (data.type === "progress") setStatus(data.message);
      if (data.type === "loaded") {
        setLoaded(data.modelId);
        if (pendingRun.current) {
          const profile = pendingRun.current;
          pendingRun.current = undefined;
          setStatus("Analyzing measured cell…");
          w.postMessage({ type: "run", profile });
        } else {
          setBusy(false);
          setStatus(`Model loaded in ${(data.loadMs / 1000).toFixed(2)} s`);
        }
      }
      if (data.type === "unloaded") {
        setLoaded("");
        setBusy(false);
        setOutput(undefined);
        setStatus("Model unloaded");
      }
      if (data.type === "result") {
        setOutput(data);
        setBusy(false);
        setStatus("Model run complete · real source cell");
      }
      if (data.type === "error") {
        pendingRun.current = undefined;
        setError(data.message);
        setBusy(false);
        setStatus("Run unavailable");
      }
    };
    w.onerror = (e) => {
      setError(e.message);
      setBusy(false);
    };
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (!preferencesReady) return;
    let active = true;
    setProfiles(undefined);
    setOutput(undefined);
    setReport(undefined);
    setError("");
    Promise.all([
      fetch(`/models/${model}-real-profiles.json`).then((r) => {
        if (!r.ok)
          throw Error(
            "Real source profiles are not available for this model yet",
          );
        return r.json();
      }),
      fetch(
        `/models/${model === "scplant" ? "scplant-report" : "conversion-report"}.json`,
      ).then((r) => r.json()),
    ])
      .then(([p, r]) => {
        if (active) {
          setProfiles(p);
          setReport(r);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [model, preferencesReady]);

  const profile = profiles?.profiles[Number(profileIndex)];
  useEffect(() => {
    if (!profile) return;
    try {
      const cached = JSON.parse(
        localStorage.getItem(`cellcast-model-result-${model}-${profile.id}`) ||
          "null",
      );
      if (
        cached?.modelId === model &&
        cached.cell === profile.id &&
        Array.isArray(cached.values) &&
        cached.values.length === (model === "scplant" ? 512 : 128) &&
        cached.values.every(Number.isFinite) &&
        Number.isFinite(cached.latencyMs)
      ) {
        setOutput(cached);
        setStatus("Saved result restored. Run again to recompute.");
      }
    } catch {}
  }, [model, profile]);
  useEffect(() => {
    if (output)
      try {
        localStorage.setItem(
          `cellcast-model-result-${output.modelId}-${output.cell}`,
          JSON.stringify(output),
        );
      } catch {}
  }, [output]);

  const rows = useMemo(
    () =>
      profile?.genes.map((g) => ({
        gene: g.gene,
        observed: g.observed,
        bin: g.bin,
      })) || [],
    [profile],
  );

  const outputs = useMemo(
    () =>
      output?.values.map((value, index) => ({
        dimension: index,
        gene:
          model === "scgpt"
            ? profile?.genes[index]?.gene || "Padding position"
            : "Latent dimension",
        value: Number(value.toFixed(6)),
      })) || [],
    [output, model, profile],
  );

  const load = () => {
    setBusy(true);
    setError("");
    setOutput(undefined);
    setLoaded("");
    worker.current?.postMessage({ type: "load", modelId: model, provider });
  };

  const run = () => {
    if (!profile) return;
    setBusy(true);
    setError("");
    setOutput(undefined);
    setStatus("Running model on measured source cell…");
    worker.current?.postMessage({ type: "run", profile });
  };

  const changeModel = (id: string) => {
    if (loaded) worker.current?.postMessage({ type: "unload" });
    setLoaded("");
    setOutput(undefined);
    setProfileIndex("0");
    setModel(id);
  };

  const exportOutput = () => {
    if (!output || !profiles) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              task:
                model === "scplant"
                  ? "Plant cell embedding"
                  : "Expression reconstruction",
              source: profiles.source,
              profileScope: profiles.description,
              preprocessing: profiles.binning,
              ...output,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model}-${output.cell}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="model-workbench">
      <aside className="model-choices">
        <h2>Available models</h2>
        <button
          className={`model-choice ${model === "scplant" ? "chosen" : ""}`}
          disabled={busy}
          onClick={() => changeModel("scplant")}
          aria-pressed={model === "scplant"}
        >
          <span className="model-choice-dot" />
          <span>
            <b>scPlantLLM</b>
            <small>Arabidopsis · cell embeddings</small>
          </span>
          <span className="model-choice-size">104 MB</span>
        </button>
        <button
          className={`model-choice ${model === "scgpt" ? "chosen" : ""}`}
          disabled={busy}
          onClick={() => changeModel("scgpt")}
          aria-pressed={model === "scgpt"}
        >
          <span className="model-choice-dot" />
          <span>
            <b>scGPT</b>
            <small>Human · expression reconstruction</small>
          </span>
          <span className="model-choice-size">203 MB</span>
        </button>
        <div className="model-availability">
          <h3>Need perturbation simulation?</h3>
          <p>
            CellOracle is a candidate for Arabidopsis transcription-factor
            simulations. It requires a fitted regulatory network and is not
            installed.
          </p>
          <a
            href="https://github.com/morris-lab/CellOracle"
            target="_blank"
            rel="noreferrer"
          >
            CellOracle documentation
            <ArrowUpRight size={12} />
          </a>
        </div>
      </aside>

      <section className="model-runner">
        <div className="model-runner-heading">
          <div>
            <h2>{model === "scplant" ? "scPlantLLM" : "scGPT Human"}</h2>
            <p>
              {model === "scplant"
                ? "Generate a cell representation from measured Arabidopsis expression."
                : "Reconstruct expression from a measured human cell profile."}
            </p>
          </div>
          <Badge variant="outline">
            {model === "scplant" ? "Arabidopsis thaliana" : "Homo sapiens"}
          </Badge>
        </div>

        <div className="model-input-form">
          <label>
            Source cell
            <NativeSelect
              aria-label="Model source cell"
              value={profileIndex}
              disabled={busy || !profiles}
              onChange={(e) => {
                setProfileIndex(e.target.value);
                setOutput(undefined);
              }}
            >
              {profiles?.profiles.map((p, i) => (
                <NativeSelectOption value={String(i)} key={p.id}>
                  {p.id}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
          <Button
            disabled={busy || !profiles}
            onClick={() => {
              if (loaded === model) run();
              else {
                pendingRun.current = profile;
                load();
              }
            }}
          >
            <Play size={14} />
            {busy ? "Running…" : "Run model"}
          </Button>
        </div>

        {profiles && (
          <div className="model-source-summary">
            <span>{profile?.genes.length} measured genes</span>
            <span>{profiles.species}</span>
            <a href={profiles.source} target="_blank" rel="noreferrer">
              Study {profiles.study}
              <ArrowUpRight size={12} />
            </a>
          </div>
        )}

        <p className="model-status" role="status">
          {status}
        </p>
        {error && (
          <div className="repository-error" role="alert">
            {error}
            <Button
              variant="outline"
              disabled={busy || !profiles}
              onClick={() => {
                pendingRun.current = profile;
                load();
              }}
            >
              Retry
            </Button>
          </div>
        )}

        <p className="model-interpretation">
          This partial-gene-panel run is exploratory. It does not predict a gene
          knockout or drug response.
        </p>

        <details className="advanced-model">
          <summary>Model & runtime details</summary>
          <div className="advanced-model-body">
            <label>
              Runtime
              <NativeSelect
                aria-label="Model execution provider"
                value={provider}
                disabled={busy || !!loaded}
                onChange={(e) => setProvider(e.target.value)}
              >
                <NativeSelectOption value="wasm">WASM</NativeSelectOption>
                <NativeSelectOption value="webgpu">
                  WebGPU · experimental
                </NativeSelectOption>
              </NativeSelect>
            </label>
            <p>
              {report ? `${(report.onnx_bytes / 1e6).toFixed(1)} MB. ` : ""}
              128-position input.{" "}
              {model === "scplant"
                ? "512-dimensional output. Arabidopsis vocabulary. License: CC BY-NC 4.0."
                : "Pretrained reconstruction; no trained perturbation head."}{" "}
              Weights run on your device.
            </p>
            <div className="model-actions">
              <Button
                variant="outline"
                disabled={busy || !profiles || loaded === model}
                onClick={load}
              >
                Load weights
              </Button>
              <Button
                variant="outline"
                disabled={!loaded || busy}
                onClick={() => {
                  setBusy(true);
                  worker.current?.postMessage({ type: "unload" });
                }}
              >
                <Power size={14} />
                Unload weights
              </Button>
              <a
                href={
                  model === "scplant"
                    ? "https://github.com/compbioNJU/scPlantLLM"
                    : "https://huggingface.co/perturblab/scgpt-human"
                }
                target="_blank"
                rel="noreferrer"
              >
                Original model
                <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </details>

        {output ? (
          <div
            className="model-result"
            data-model={output.modelId}
            data-cell={output.cell}
          >
            <div className="model-result-header">
              <div>
                <h3>
                  {model === "scplant"
                    ? "Cell embedding"
                    : "Reconstructed expression"}
                </h3>
                <p>
                  {output.values.length} values <span>•</span>{" "}
                  {output.latencyMs.toFixed(0)} ms <span>•</span> numerical
                  error {output.maxAbsError?.toExponential(1) || "not measured"}
                </p>
              </div>
              <Button variant="outline" onClick={exportOutput}>
                <Download size={14} />
                Export
              </Button>
            </div>
            <DataGrid
              id={`${model}-output`}
              title="Model output"
              columns={[
                {
                  key: "dimension",
                  label: model === "scplant" ? "Dimension" : "Position",
                },
                ...(model === "scgpt" ? [{ key: "gene", label: "Gene" }] : []),
                { key: "value", label: "Value" },
              ]}
              rows={outputs}
            />
          </div>
        ) : (
          <div className="model-empty">
            <Cpu size={24} />
            <h3>Ready to analyze a cell</h3>
            <p>
              Choose a measured cell above. The model loads automatically on
              your first run.
            </p>
          </div>
        )}

        {profile && profiles && (
          <details className="input-details">
            <summary>Inspect input measurements</summary>
            <DataGrid
              id={`${model}-inputs-${profile.id}`}
              key={`${model}-${profile.id}`}
              title="Model inputs"
              columns={[
                { key: "gene", label: "Gene" },
                { key: "observed", label: `Observed (${profiles.unit})` },
                { key: "bin", label: "Model bin" },
              ]}
              rows={rows}
            />
          </details>
        )}
      </section>
    </div>
  );
}
