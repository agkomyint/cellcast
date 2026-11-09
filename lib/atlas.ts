import { readAtlasText } from "./atlas-fetch";
export const ATLAS = "https://www.ebi.ac.uk/gxa/sc/";
export type Study = {
  id: string;
  title: string;
  species: string;
  kingdom: string;
  cells: number;
  technology: string[];
  factors: string[];
  updated: string;
  source: string;
  downloads: string;
};
export type CellPoint = {
  id: string;
  x: number;
  y: number;
  group: string;
  expression?: number;
};
export type CellData = {
  points: CellPoint[];
  groups: { name: string; count: number }[];
  method: string;
  parameter: string;
  colourBy: string;
  grouping?: string;
  groupingOptions?: { value: string; label: string }[];
  unit?: string;
  source: string;
  retrievedAt: string;
  stats?: {
    min: number;
    max: number;
    mean: number;
    expressing: number;
    total: number;
  };
};
type AtlasStudy = {
  experimentAccession: string;
  experimentDescription: string;
  species: string;
  kingdom: string;
  numberOfAssays: number;
  technologyType: string[];
  experimentalFactors: string[];
  lastUpdate: string;
};
let cache: { studies: Study[]; at: number } | undefined;
export const atlasText = readAtlasText;
export async function studies(refresh = false): Promise<Study[]> {
  if (!refresh && cache && Date.now() - cache.at < 3600000)
    return cache.studies;
  const payload = JSON.parse(await atlasText(`${ATLAS}json/experiments`, 24_000_000, { refresh }));
  if (!Array.isArray(payload.experiments))
    throw Error("Unexpected Atlas catalogue response");
  const data = payload.experiments
    .filter((s: AtlasStudy) => /^E-[A-Z]+-\d+$/.test(s.experimentAccession))
    .map((s: AtlasStudy) => ({
      id: s.experimentAccession,
      title: s.experimentDescription,
      species: s.species,
      kingdom: s.kingdom,
      cells: s.numberOfAssays,
      technology: s.technologyType || [],
      factors: s.experimentalFactors || [],
      updated: s.lastUpdate,
      source: `${ATLAS}experiments/${s.experimentAccession}`,
      downloads: `${ATLAS}experiments/${s.experimentAccession}/downloads`,
    }));
  cache = { studies: data, at: Date.now() };
  return data;
}
export async function study(id: string) {
  if (!/^E-[A-Z]+-\d+$/.test(id)) throw Error("Invalid study accession");
  const found = (await studies()).find((s) => s.id === id);
  if (!found) throw Error("Study not found in the Atlas catalogue");
  return found;
}

export async function geneSuggestions(id: string, query = "", signal?: AbortSignal) {
  const source = await study(id);
  query = query.trim().slice(0, 80);
  const seeds = query ? [query]
    : source.species.startsWith("Arabidopsis") ? ["AT1G01010", "AT3G18780", "AT4G05320"]
    : source.species === "Homo sapiens" ? ["ENSG00000141510", "ENSG00000115415", "ENSG00000075624"]
    : source.species.includes("Japonica") ? ["Os01g0100100"] : [];
  const names: Record<string, string> = { AT1G01010: "NAC001", AT3G18780: "ACT2", AT4G05320: "UBQ10", ENSG00000141510: "TP53", ENSG00000115415: "STAT1", ENSG00000075624: "ACTB" };
  const results = await Promise.all(seeds.map(async q => {
    const url = new URL(`${ATLAS}json/suggestions`);
    url.searchParams.set("query", query ? q : names[q] || q);
    url.searchParams.set("species", source.species.toLowerCase());
    const payload = JSON.parse(await atlasText(url.toString(), 1_000_000, { signal }));
    return Array.isArray(payload) ? payload : [];
  }));
  const suggestions: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const item of results.flat()) {
    if (typeof item.category !== "string" || !/^[A-Za-z0-9_.:-]{1,100}$/.test(item.category) || typeof item.term !== "string") continue;
    if (!query && !seeds.includes(item.category)) continue;
    if (!seen.has(item.category)) { seen.add(item.category); suggestions.push({ id: item.category, label: item.term }); }
  }
  return { suggestions: suggestions.slice(0, 20), species: source.species, scope: "organism" };
}
export type PlotConfig = {
  ks: number[];
  selectedK: number;
  metadata: { value: string; label: string }[];
  defaultPlotMethodAndParameterisation: Record<string, Record<string, number>>;
};
export async function configuration(id: string, signal?: AbortSignal): Promise<PlotConfig> {
  if (!/^E-[A-Z]+-\d+$/.test(id)) throw Error("Invalid study accession");
  // Atlas permits CORS for JSON, but not its HTML study pages. Only this small
  // configuration crosses our server; measured cell data is fetched directly.
  if (typeof window !== "undefined") {
    const response = await fetch(`/api/datasets/${id}/configuration`, { signal });
    const payload = await response.json();
    if (!response.ok) throw Error(payload.error || "Study configuration is unavailable. Retry or open the source study.");
    return payload;
  }
  const html = await atlasText(`${ATLAS}experiments/${id}`);
  const match = html.match(/content:\s*(\{[^\n]+\}),?\s*\n/);
  if (!match)
    throw Error(
      "Atlas plot configuration is unavailable. Open the source study for its data.",
    );
  const page = JSON.parse(match[1]);
  const config = page.tabs?.find(
    (tab: { type: string }) => tab.type === "results",
  )?.props;
  if (!config) throw Error("This study does not expose a cell plot");
  return config;
}
export async function cells(
  id: string,
  gene?: string,
  groupBy?: string,
  signal?: AbortSignal,
): Promise<CellData> {
  await study(id);
  if (gene && !/^[a-zA-Z0-9_.:-]{1,100}$/.test(gene))
    throw Error("Enter a valid source gene identifier");
  const config = await configuration(id, signal);
  const methods = config.defaultPlotMethodAndParameterisation;
  const method = methods.UMAP ? "UMAP" : Object.keys(methods)[0];
  if (!method) throw Error("No embedding is available for this study");
  const parameters = methods[method];
  if (groupBy && !config.metadata?.some((m) => m.value === groupBy))
    throw Error("This grouping is not available in the source study");
  const metadata = groupBy
    ? config.metadata.find((m) => m.value === groupBy)
    : config.metadata?.find((m) => /authors.labels/.test(m.value)) ||
      config.metadata?.find((m) => /cell.type/.test(m.value)) ||
      config.metadata?.find((m) =>
        /compound|genotype|environmental.stress|stimulus/.test(m.value),
      );
  const colourBy = metadata
    ? metadata.label
    : `Atlas clusters (k=${config.selectedK})`;
  const resource = gene
    ? `expression/${encodeURIComponent(gene)}`
    : metadata
      ? `clusters/metadata/${encodeURIComponent(metadata.value)}`
      : `clusters/k/${config.selectedK}`;
  const url = new URL(`${ATLAS}json/cell-plots/${id}/${resource}`);
  url.searchParams.set("plotMethod", method);
  for (const [k, v] of Object.entries(parameters))
    url.searchParams.set(k, String(v));
  const data = JSON.parse(await atlasText(url.toString(), 24_000_000, { signal }));
  if (!Array.isArray(data.series))
    throw Error("Atlas returned no cell data for this query");
  if (gene && (!Number.isFinite(data.min) || !Number.isFinite(data.max)))
    throw Error(
      "Gene ID not found in this source study. Use a stable Ensembl or TAIR identifier, not a gene symbol.",
    );
  const points: CellPoint[] = [];
  const groups: { name: string; count: number }[] = [];
  for (const series of data.series) {
    let count = 0;
    for (const row of series.data || []) {
      if (
        typeof row[2] !== "string" ||
        !Number.isFinite(row[0]) ||
        !Number.isFinite(row[1])
      )
        continue;
      if (gene && !Number.isFinite(row[3])) continue;
      points.push({
        id: row[2],
        x: row[0],
        y: row[1],
        group: String(series.name),
        ...(gene ? { expression: row[3] } : {}),
      });
      count++;
    }
    groups.push({ name: String(series.name), count });
  }
  if (points.length > 150000)
    throw Error(
      "This study exceeds the 150,000-cell preview limit. Use the source downloads for the full dataset.",
    );
  if (!points.length)
    throw Error(
      gene
        ? "No expression values returned. Check the source gene ID."
        : "No cell coordinates were returned",
    );
  let stats: CellData["stats"];
  if (gene) {
    let min = Infinity,
      max = -Infinity,
      sum = 0,
      expressing = 0;
    for (const p of points) {
      const v = p.expression!;
      min = Math.min(min, v);
      max = Math.max(max, v);
      sum += v;
      if (v > 0) expressing++;
    }
    stats = {
      min,
      max,
      mean: sum / points.length,
      expressing,
      total: points.length,
    };
  }
  return {
    points,
    groups,
    method,
    parameter: Object.entries(parameters)
      .map(([k, v]) => `${k}=${v}`)
      .join(", "),
    colourBy,
    grouping: metadata?.value || "",
    groupingOptions: config.metadata || [],
    unit: data.unit,
    source: url.toString(),
    retrievedAt: new Date().toISOString(),
    stats,
  };
}
