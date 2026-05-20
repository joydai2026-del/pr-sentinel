/**
 * API client for PR Sentinel backend.
 * Points at NEXT_PUBLIC_BACKEND_URL (set in Vercel env or .env.local).
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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

export async function runReview(payload: {
  diff: string;
  pr_title: string;
  pr_body: string;
  pr_url?: string;
}): Promise<ReviewResponse> {
  const res = await fetch(`${BACKEND_URL}/review/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  storage: string;
}> {
  const res = await fetch(`${BACKEND_URL}/healthz`);
  return res.json();
}
