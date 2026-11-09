import { ATLAS, atlasText, study } from "@/lib/atlas";
export const maxDuration = 300;
const cache = new Map<
  string,
  { at: number; value: { id: string; label: string }[] }
>();
export async function GET(
  request: Request,
  { params }: { params: Promise<{ accession: string }> },
) {
  try {
    const { accession } = await params;
    const source = await study(accession);
    const query = (new URL(request.url).searchParams.get("q") || "")
      .trim()
      .slice(0, 80);
    const key = `${source.species}:${query}`;
    const saved = cache.get(key);
    if (saved && Date.now() - saved.at < 3600000)
      return Response.json({
        suggestions: saved.value,
        species: source.species,
        scope: "organism",
      });
    const seeds = query
      ? [query]
      : source.species.startsWith("Arabidopsis")
        ? ["AT1G01010", "AT3G18780", "AT4G05320"]
        : source.species === "Homo sapiens"
          ? ["ENSG00000141510", "ENSG00000115415", "ENSG00000075624"]
          : source.species.includes("Japonica")
            ? ["Os01g0100100"]
            : [];
    const names: Record<string, string> = {
      AT1G01010: "NAC001",
      AT3G18780: "ACT2",
      AT4G05320: "UBQ10",
      ENSG00000141510: "TP53",
      ENSG00000115415: "STAT1",
      ENSG00000075624: "ACTB",
    };
    const results = await Promise.all(
      seeds.map(async (q) => {
        const url = new URL(`${ATLAS}json/suggestions`);
        url.searchParams.set("query", query ? q : names[q] || q);
        url.searchParams.set("species", source.species.toLowerCase());
        const payload = JSON.parse(await atlasText(url.toString(), 1000000));
        return Array.isArray(payload) ? payload : [];
      }),
    );
    const suggestions: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const item of results.flat()) {
      if (
        typeof item.category !== "string" ||
        !/^[A-Za-z0-9_.:-]{1,100}$/.test(item.category) ||
        typeof item.term !== "string"
      )
        continue;
      if (!query && !seeds.includes(item.category)) continue;
      if (!seen.has(item.category)) {
        seen.add(item.category);
        suggestions.push({ id: item.category, label: item.term });
      }
    }
    if (cache.size >= 256) cache.clear();
    cache.set(key, { at: Date.now(), value: suggestions.slice(0, 20) });
    return Response.json({
      suggestions: suggestions.slice(0, 20),
      species: source.species,
      scope: "organism",
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gene suggestions are unavailable",
      },
      { status: 502 },
    );
  }
}
