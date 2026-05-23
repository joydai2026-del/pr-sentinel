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

export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json(
      { detail: "PR_SENTINEL_API_KEY is not configured on the Next.js server." },
      { status: 503 }
    );
  }

  const declared = parseInt(req.headers.get("content-length") || "0", 10);
  if (declared > MAX_PROXY_BODY_BYTES) {
    return NextResponse.json(
      { detail: `Request body too large (max ${MAX_PROXY_BODY_BYTES} bytes).` },
      { status: 413 }
    );
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return NextResponse.json({ detail: "Failed to read request body" }, { status: 400 });
  }
  if (body.length > MAX_PROXY_BODY_BYTES) {
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
