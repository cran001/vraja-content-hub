import { gzipSync } from 'node:zlib';
import { NextResponse } from 'next/server';

/** Below this, gzip framing costs more than it saves. */
const MIN_GZIP_BYTES = 1024;

/**
 * JSON response that gzips its body when the caller advertises support.
 *
 * A full scripture is a few megabytes of Devanagari, IAST and translation text — exactly the
 * payload that must not go over the wire raw. Compression is done here rather than left to the
 * platform so it applies identically on `next start`, on Vercel and behind any proxy.
 *
 * OkHttp (which the Android app uses) sends `Accept-Encoding: gzip` by default and transparently
 * inflates the response, so the app needs no changes. Callers that do not advertise gzip — a
 * browser fetch with an explicit override, curl without --compressed — get plain JSON.
 */
export function gzippedJson(
  data: unknown,
  request: Request,
  init: { status?: number; headers?: Record<string, string> } = {},
): NextResponse {
  const body = JSON.stringify(data);
  const acceptsGzip = /\bgzip\b/i.test(request.headers.get('accept-encoding') ?? '');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    // Caches must key on the encoding, or a gzipped body can be replayed to a client that
    // never asked for one.
    Vary: 'Accept-Encoding',
    ...(init.headers ?? {}),
  };

  if (!acceptsGzip || body.length < MIN_GZIP_BYTES) {
    return new NextResponse(body, { status: init.status ?? 200, headers });
  }

  // Buffer is copied into a plain Uint8Array so the body type is a portable BodyInit.
  const compressed = new Uint8Array(gzipSync(Buffer.from(body, 'utf8')));
  return new NextResponse(compressed, {
    status: init.status ?? 200,
    headers: { ...headers, 'Content-Encoding': 'gzip' },
  });
}
