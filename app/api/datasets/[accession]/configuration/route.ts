import { configuration } from "@/lib/atlas";
import { AtlasRequestError } from "@/lib/atlas-fetch";

export const maxDuration = 120;

export async function GET(_request: Request, { params }: { params: Promise<{ accession: string }> }) {
  const { accession } = await params;
  if (!/^E-[A-Z]+-\d+$/.test(accession)) return Response.json({ error: "Invalid study accession" }, { status: 400 });
  try {
    return Response.json(await configuration(accession), {
      headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Study configuration is unavailable. Retry or open the source study.",
      code: error instanceof AtlasRequestError ? error.code : "ATLAS_CONFIGURATION",
    }, { status: error instanceof AtlasRequestError && error.code === "ATLAS_TIMEOUT" ? 504 : 502, headers: { "Cache-Control": "no-store" } });
  }
}
