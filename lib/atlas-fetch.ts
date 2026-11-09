type ReadOptions = { refresh?: boolean; signal?: AbortSignal };

export class AtlasRequestError extends Error {
  constructor(message: string, public code: "ATLAS_TIMEOUT" | "ATLAS_UNAVAILABLE" | "ATLAS_RESPONSE", public retryable = false) {
    super(message);
    this.name = "AtlasRequestError";
  }
}

/** Shared browser/server reader: bounded responses, bounded caching, one retry. */
export function createAtlasReader({
  fetcher = fetch,
  timeoutMs = 45_000,
  cacheMs = 3_600_000,
  maxCacheBytes = 16_000_000,
}: { fetcher?: typeof fetch; timeoutMs?: number; cacheMs?: number; maxCacheBytes?: number } = {}) {
  const cache = new Map<string, { text: string; at: number; bytes: number }>();
  const pending = new Map<string, Promise<string>>();
  let cacheBytes = 0;

  const download = async (url: string, maxBytes: number, refresh: boolean) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const signal = AbortSignal.timeout(timeoutMs);
      try {
        const response = await fetcher(url, {
          signal,
          // Atlas JSON is CORS-enabled. Next's persistent cache is used only for
          // small metadata; cell-plot responses can exceed its entry-size limit.
          ...(typeof window === "undefined"
            ? refresh || url.includes("/json/cell-plots/")
              ? { cache: "no-store" as const }
              : { next: { revalidate: 3600 } }
            : { cache: refresh ? "reload" as const : "default" as const }),
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => {});
          throw new AtlasRequestError(`Atlas returned ${response.status}. Retry the request or open the source study.`, "ATLAS_RESPONSE", response.status >= 500 || response.status === 429);
        }
        const reader = response.body?.getReader();
        if (!reader) throw new AtlasRequestError("Atlas returned an empty response. Retry the request.", "ATLAS_RESPONSE");
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > maxBytes) throw new AtlasRequestError("This response exceeds the preview size limit. Open the source downloads for the full data.", "ATLAS_RESPONSE");
            chunks.push(value);
          }
        } finally { await reader.cancel().catch(() => {}); }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return { text: new TextDecoder().decode(bytes), bytes: size };
      } catch (error) {
        const failure = signal.aborted || (error instanceof Error && error.name === "TimeoutError")
          ? new AtlasRequestError("Single Cell Expression Atlas is taking too long to respond. CellCast retried once. Retry the request, choose another study, or open the source study.", "ATLAS_TIMEOUT", true)
          : error instanceof AtlasRequestError ? error
          : new AtlasRequestError("Could not reach Single Cell Expression Atlas. Check your connection, retry, or open the source study.", "ATLAS_UNAVAILABLE", true);
        if (attempt === 1 || !failure.retryable) throw failure;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }
    throw new Error("Atlas request failed");
  };

  return async (url: string, maxBytes = 24_000_000, options: ReadOptions = {}): Promise<string> => {
    if (options.signal?.aborted) throw options.signal.reason;
    const key = `${maxBytes}:${url}`;
    const saved = cache.get(key);
    if (!options.refresh && saved && Date.now() - saved.at < cacheMs) return saved.text;
    let request = pending.get(key);
    if (!request) {
      request = download(url, maxBytes, !!options.refresh).then(value => {
        const previous = cache.get(key);
        if (previous) { cache.delete(key); cacheBytes -= previous.bytes; }
        if (value.bytes <= maxCacheBytes) {
          while (cacheBytes + value.bytes > maxCacheBytes || cache.size >= 128) {
            const oldest = cache.keys().next().value;
            if (!oldest) break;
            cacheBytes -= cache.get(oldest)!.bytes;
            cache.delete(oldest);
          }
          cache.set(key, { ...value, at: Date.now() });
          cacheBytes += value.bytes;
        }
        return value.text;
      }).finally(() => pending.delete(key));
      pending.set(key, request);
    }
    if (!options.signal) return request;
    // One caller navigating away must not abort a shared request for another view.
    return new Promise((resolve, reject) => {
      const abort = () => reject(options.signal!.reason);
      options.signal!.addEventListener("abort", abort, { once: true });
      request!.then(resolve, reject).finally(() => options.signal!.removeEventListener("abort", abort));
    });
  };
}

export const readAtlasText = createAtlasReader();
