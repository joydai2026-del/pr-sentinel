/**
 * API client for PR Sentinel backend.
 *
 * NEXT_PUBLIC_BACKEND_URL and NEXT_PUBLIC_API_KEY are baked at build time by
 * Next.js. They MUST be set in the Vercel project env BEFORE `vercel --prod`,
 * otherwise the production bundle will point at http://localhost:8000 and have
 * no API key. We refuse to call the backend without a key.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY || "";

export interface LensResult {
  verdict: "PASS" | "NEEDS-FIXES" | "BLOCK";
  summary: string;
  must_fixes: string[];
}

export interface ReviewResponse {
  verdict: "PASS" | "NEEDS-FIXES" | "BLOCK";
  total_must_fixes: number;
  lenses: {
    code_review: LensResult;
    security: LensResult;
    reality: LensResult;
    adversarial: LensResult;
  };
  run_id: string;
  storage_backend: string;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["X-API-Key"] = API_KEY;
  return headers;
}

export async function runReview(payload: {
  diff: string;
  pr_title: string;
  pr_body: string;
  pr_url?: string;
}): Promise<ReviewResponse> {
  if (!API_KEY) {
    throw new Error(
      "NEXT_PUBLIC_API_KEY is not set. Set it in your Vercel project env (or .env.local) before calling the backend."
    );
  }
  const res = await fetch(`${BACKEND_URL}/review/sync`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Backend error ${res.status}: ${err}`);
  }

  return res.json();
}

export async function healthz(): Promise<{
  status: string;
  version: string;
}> {
  const res = await fetch(`${BACKEND_URL}/healthz`);
  if (!res.ok) {
    throw new Error(`Healthz failed ${res.status}`);
  }
  return res.json();
}
