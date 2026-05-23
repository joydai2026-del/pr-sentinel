/**
 * Frontend API client for PR Sentinel.
 *
 * The browser only ever talks to its own origin at /api/review. That route is a
 * Next.js server function (web/app/api/review/route.ts) which holds the real
 * backend URL + API key via server-only env vars. Nothing secret ships in the
 * browser bundle.
 */

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
  const res = await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Review failed ${res.status}: ${err}`);
  }
  return res.json();
}
