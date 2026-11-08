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
export async function atlasText(url: string, maxBytes = 24_000_000) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
    cache: "no-store",
  });
  if (!response.ok)
    throw Error(
      `Atlas returned ${response.status}. Try again or open the source study.`,
    );
  const reader = response.body?.getReader();
  if (!reader) throw Error("Atlas returned an empty response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes)
        throw Error(
          "This dataset exceeds the 24 MB preview limit. Download the full data from the source study.",
        );
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(bytes);
}
export async function studies(refresh = false): Promise<Study[]> {
  if (!refresh && cache && Date.now() - cache.at < 3600000)
    return cache.studies;
  const payload = JSON.parse(await atlasText(`${ATLAS}json/experiments`));
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
type PlotConfig = {
  ks: number[];
  selectedK: number;
  metadata: { value: string; label: string }[];
  defaultPlotMethodAndParameterisation: Record<string, Record<string, number>>;
};
async function configuration(id: string): Promise<PlotConfig> {
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
): Promise<CellData> {
  await study(id);
  if (gene && !/^[a-zA-Z0-9_.:-]{1,100}$/.test(gene))
    throw Error("Enter a valid source gene identifier");
  const config = await configuration(id);
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
  const data = JSON.parse(await atlasText(url.toString()));
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
