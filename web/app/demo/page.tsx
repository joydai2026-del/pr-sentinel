"use client";

import { useState } from "react";
import Link from "next/link";
import { runReview, ReviewResponse, LensResult } from "@/lib/api";

// ── Example diffs ─────────────────────────────────────────────────────────

const EXAMPLES = {
  a: {
    label: "Example A: Clean code",
    pr_title: "Add math utility functions",
    pr_body: "Adds add, subtract, and multiply helper functions to utils/math.py",
    diff: `--- a/utils/math.py
+++ b/utils/math.py
@@ -0,0 +1,12 @@
+def add(a: int, b: int) -> int:
+    """Return the sum of two integers."""
+    return a + b
+
+def subtract(a: int, b: int) -> int:
+    """Return a minus b."""
+    return a - b
+
+def multiply(a: int, b: int) -> int:
+    """Return the product of two integers."""
+    return a * b`,
  },
  b: {
    label: "Example B: SQL injection",
    pr_title: "Add user lookup endpoint",
    pr_body: "Adds a fast username lookup for the admin dashboard",
    diff: `--- a/api/users.py
+++ b/api/users.py
@@ -5,6 +5,10 @@
 import sqlite3

+def get_user(username: str):
+    conn = sqlite3.connect("users.db")
+    query = f"SELECT * FROM users WHERE username = '{username}'"
+    return conn.execute(query).fetchone()`,
  },
  c: {
    label: "Example C: Dead code",
    pr_title: "Deprecate legacy payment module",
    pr_body: "Marks old payment functions as deprecated before removal next sprint",
    diff: `--- a/services/legacy.py
+++ b/services/legacy.py
@@ -1,0 +1,12 @@
+# TODO: remove this entire module after migration
+def old_process_payment(amount):
+    # This is never called anymore
+    pass
+
+def _internal_helper():
+    # Unreachable since refactor
+    return None
+
+DEPRECATED_CONSTANT = 42  # unused`,
  },
};

// ── Verdict badge ─────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  const styles: Record<string, string> = {
    PASS: "bg-green-900 text-green-300 border-green-700",
    "NEEDS-FIXES": "bg-yellow-900 text-yellow-300 border-yellow-700",
    BLOCK: "bg-red-900 text-red-300 border-red-700",
  };
  const icons: Record<string, string> = {
    PASS: "PASS",
    "NEEDS-FIXES": "NEEDS FIXES",
    BLOCK: "BLOCK",
  };
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border ${
        styles[verdict] || "bg-gray-800 text-gray-300 border-gray-600"
      }`}
    >
      {icons[verdict] || verdict}
    </span>
  );
}

// ── Lens panel ────────────────────────────────────────────────────────────

const LENS_META: Record<string, { icon: string; label: string }> = {
  code_review: { icon: "🔍", label: "Code Review" },
  security: { icon: "🔒", label: "Security" },
  reality: { icon: "🎯", label: "Reality Check" },
  adversarial: { icon: "💥", label: "Adversarial" },
};

function LensPanel({
  name,
  result,
}: {
  name: string;
  result: LensResult;
}) {
  const [open, setOpen] = useState(false);
  const meta = LENS_META[name] || { icon: "?", label: name };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{meta.icon}</span>
          <span className="font-medium text-white">{meta.label}</span>
        </div>
        <div className="flex items-center gap-3">
          <VerdictBadge verdict={result.verdict} />
          <span className="text-gray-500 text-sm">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-800 pt-4">
          <p className="text-gray-300 text-sm mb-4 leading-relaxed">
            {result.summary}
          </p>
          {result.must_fixes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Must Fix ({result.must_fixes.length})
              </p>
              <ul className="space-y-2">
                {result.must_fixes.map((fix, i) => (
                  <li
                    key={i}
                    className="text-sm text-red-300 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2"
                  >
                    {fix}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.must_fixes.length === 0 && (
            <p className="text-xs text-green-400">No must-fix issues.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Result card ───────────────────────────────────────────────────────────

function ResultCard({ result, runMs }: { result: ReviewResponse; runMs: number }) {
  const headerStyle: Record<string, string> = {
    PASS: "bg-green-950 border-green-800",
    "NEEDS-FIXES": "bg-yellow-950 border-yellow-800",
    BLOCK: "bg-red-950 border-red-800",
  };

  return (
    <div className="mt-8 space-y-4">
      {/* Overall verdict header */}
      <div
        className={`rounded-xl border p-6 ${headerStyle[result.verdict] || "bg-gray-900 border-gray-800"}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Final verdict</span>
          <span className="text-xs text-gray-500">
            {(runMs / 1000).toFixed(1)}s · run {result.run_id.slice(0, 8)}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <VerdictBadge verdict={result.verdict} />
          <span className="text-gray-300 text-sm">
            {result.total_must_fixes} must-fix issue
            {result.total_must_fixes !== 1 ? "s" : ""} across 4 lenses
          </span>
        </div>
      </div>

      {/* Lens panels */}
      {(Object.entries(result.lenses) as [string, LensResult][]).map(
        ([name, lens]) => (
          <LensPanel key={name} name={name} result={lens} />
        )
      )}

      {/* Raw JSON toggle */}
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer hover:text-gray-300 py-2">
          Raw JSON response
        </summary>
        <pre className="mt-2 bg-gray-950 border border-gray-800 rounded-lg p-4 overflow-x-auto text-gray-400">
          {JSON.stringify(result, null, 2)}
        </pre>
      </details>
    </div>
  );
}

// ── Main demo page ────────────────────────────────────────────────────────

export default function DemoPage() {
  const [diff, setDiff] = useState("");
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [runMs, setRunMs] = useState(0);

  function loadExample(key: keyof typeof EXAMPLES) {
    const ex = EXAMPLES[key];
    setDiff(ex.diff);
    setPrTitle(ex.pr_title);
    setPrBody(ex.pr_body);
    setResult(null);
    setError(null);
  }

  async function submit() {
    if (!diff.trim()) {
      setError("Please enter a diff or click one of the example buttons.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    const t0 = Date.now();
    try {
      const r = await runReview({ diff, pr_title: prTitle, pr_body: prBody });
      setRunMs(Date.now() - t0);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🛡</span>
          <span className="font-bold text-xl text-white">PR Sentinel</span>
        </Link>
        <span className="text-sm text-gray-400 bg-gray-900 px-3 py-1 rounded-full border border-gray-700">
          Live demo
        </span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">
            Try 4-lens review
          </h1>
          <p className="text-gray-400">
            Paste a unified diff below or pick an example. Results come from
            live Claude API calls. no mocks.
          </p>
        </div>

        {/* Example buttons */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {(Object.entries(EXAMPLES) as [keyof typeof EXAMPLES, typeof EXAMPLES.a][]).map(
            ([key, ex]) => (
              <button
                key={key}
                onClick={() => loadExample(key)}
                className="bg-gray-900 border border-gray-700 hover:border-gray-500 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {ex.label}
              </button>
            )
          )}
        </div>

        {/* Input form */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">PR Title</label>
              <input
                value={prTitle}
                onChange={(e) => setPrTitle(e.target.value)}
                placeholder="Fix: user authentication bypass"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">PR Body</label>
              <input
                value={prBody}
                onChange={(e) => setPrBody(e.target.value)}
                placeholder="What does this PR do?"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Unified Diff{" "}
              <span className="text-gray-600">(paste output of git diff)</span>
            </label>
            <textarea
              value={diff}
              onChange={(e) => setDiff(e.target.value)}
              placeholder={`--- a/file.py\n+++ b/file.py\n@@ -1,3 +1,5 @@\n+def new_function():\n+    pass`}
              rows={14}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300 font-mono placeholder-gray-700 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                Running 4 lenses in parallel...
              </>
            ) : (
              "Run 4-lens review"
            )}
          </button>
        </div>

        {/* Results */}
        {result && <ResultCard result={result} runMs={runMs} />}
      </div>
    </div>
  );
}
