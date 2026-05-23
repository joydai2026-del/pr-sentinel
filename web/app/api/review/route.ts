/**
 * Server-side proxy for the pr-sentinel backend.
 *
 * The API key + backend URL are read from server-only env vars (no NEXT_PUBLIC_
 * prefix), so they stay out of the browser bundle. The browser hits /api/review
 * on the same origin; this route forwards to the backend with the key attached.
 *
 * Required env (server-only):
 *   PR_SENTINEL_BACKEND_URL   e.g. https://<...>.modal.run
 *   PR_SENTINEL_API_KEY       same value as the backend's PR_SENTINEL_API_KEY
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Always evaluate env vars at request time, never bake them in the static build.
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.PR_SENTINEL_BACKEND_URL || "http://localhost:8000";
const API_KEY = process.env.PR_SENTINEL_API_KEY || "";

// 200 KB is comfortably above the backend's 100 KB diff cap + JSON overhead.
// Rejecting oversized payloads here prevents abuse of serverless-edge memory/egress
// before the backend ever sees the request.
const MAX_PROXY_BODY_BYTES = 200_000;


/**
 * Read the request body as UTF-8 text, but bail out the moment we exceed
 * `maxBytes` actual bytes (not UTF-16 string length, not the declared header).
 * Returns null if the body is over the cap; the caller should 413.
 */
async function readBoundedBody(
  req: Request,
  maxBytes: number
): Promise<string | null> {
  if (!req.body) return "";
  const reader = req.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          /* best-effort cancel */
        }
        return null;
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    return null;
  }
  return text;
}

export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json(
      { detail: "PR_SENTINEL_API_KEY is not configured on the Next.js server." },
      { status: 503 }
    );
  }

  const declared = parseInt(req.headers.get("content-length") || "0", 10);
  if (declared && declared > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json(
      { detail: `Request body too large (max ${MAX_PROXY_BODY_BYTES} bytes).` },
      { status: 413 }
    );
  }

  // Stream-read the body, counting actual bytes (UTF-8) and aborting early on
  // overflow. Avoids req.text() which would buffer unboundedly when
  // Content-Length is missing or lying.
  const body = await readBoundedBody(req, MAX_PROXY_BODY_BYTES);
  if (body === null) {
    return NextResponse.json(
      { detail: `Request body too large (max ${MAX_PROXY_BODY_BYTES} bytes).` },
      { status: 413 }
    );
  }

  const upstream = await fetch(`${BACKEND_URL}/review/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body,
  });

  const text = await upstream.text();
  // Pass the backend's status and body through, but never its headers.
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
