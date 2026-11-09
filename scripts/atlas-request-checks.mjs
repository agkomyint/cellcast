import assert from 'node:assert/strict';
import { createAtlasReader } from '../lib/atlas-fetch.ts';

const timeout = signal => new Promise((resolve, reject) => {
  const keepAlive = setTimeout(() => resolve(new Response('too late')), 100);
  signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(signal.reason); }, { once: true });
});
let calls = 0;
const recovering = createAtlasReader({ timeoutMs: 5, fetcher: async (_url, { signal }) => ++calls === 1 ? timeout(signal) : new Response('real response') });
assert.equal(await recovering('https://atlas.test/retry'), 'real response');
assert.equal(calls, 2, 'A timed-out request should retry once');
await recovering('https://atlas.test/retry');
assert.equal(calls, 2, 'Successful data should be cached');
await recovering('https://atlas.test/retry', undefined, { refresh: true });
assert.equal(calls, 3);

let failures = 0;
const unavailable = createAtlasReader({ timeoutMs: 5, fetcher: async (_url, { signal }) => { failures++; return timeout(signal); } });
await assert.rejects(unavailable('https://atlas.test/slow'), error => error.code === 'ATLAS_TIMEOUT' && /retried once/.test(error.message) && !/operation was aborted/i.test(error.message));
assert.equal(failures, 2, 'Repeated timeouts must stop after the second attempt');

let missing = 0;
const notFound = createAtlasReader({ fetcher: async () => { missing++; return new Response('', { status: 404 }); } });
await assert.rejects(notFound('https://atlas.test/404'), /404/);
assert.equal(missing, 1, 'Missing genes/resources should not be retried');
let oversize = 0;
const bounded = createAtlasReader({ fetcher: async () => { oversize++; return new Response('123456'); } });
await assert.rejects(bounded('https://atlas.test/large', 5), /preview size limit/);
assert.equal(oversize, 1, 'Oversized responses should not be retried');

let resolveFetch;
let sharedCalls = 0;
const shared = createAtlasReader({ fetcher: () => { sharedCalls++; return new Promise(resolve => { resolveFetch = resolve; }); } });
const controller = new AbortController();
const leaving = shared('https://atlas.test/shared', 100, { signal: controller.signal });
const staying = shared('https://atlas.test/shared', 100);
controller.abort();
await assert.rejects(leaving, error => error.name === 'AbortError');
resolveFetch(new Response('same measured data'));
assert.equal(await staying, 'same measured data');
assert.equal(sharedCalls, 1, 'Leaving one view must not cancel another view’s shared request');

let streamCalls = 0;
const streamed = createAtlasReader({ timeoutMs: 5, fetcher: async (_url, { signal }) => {
  streamCalls++;
  if (streamCalls > 1) return new Response('complete');
  return new Response(new ReadableStream({ start(controller) {
    const timer = setTimeout(() => controller.close(), 100);
    controller.enqueue(new TextEncoder().encode('partial'));
    signal.addEventListener('abort', () => { clearTimeout(timer); controller.error(signal.reason); }, { once: true });
  } }));
} });
assert.equal(await streamed('https://atlas.test/stream'), 'complete', 'Retry must cover body timeouts, not just response headers');
assert.equal(streamCalls, 2);
console.log('Passed: timeout recovery, bounded retries, cache reuse, refresh, 404 handling, response-size cap, shared cancellation, and streamed-body timeout.');
