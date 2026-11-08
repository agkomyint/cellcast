import { cells } from "@/lib/atlas";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ accession: string }> },
) {
  try {
    const { accession } = await params;
    const gene = new URL(request.url).searchParams.get("gene") || undefined;
    return Response.json(
      await cells(
        accession,
        gene,
        new URL(request.url).searchParams.get("groupBy") || undefined,
      ),
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Dataset unavailable" },
      { status: 502 },
    );
  }
}
