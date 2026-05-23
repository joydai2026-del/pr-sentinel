import Link from "next/link";

const COMPETITORS = [
  {
    name: "Greptile",
    models: "1",
    latency: "~30s",
    freeTier: "Limited",
    openCore: "No",
    highlight: false,
  },
  {
    name: "CodeRabbit",
    models: "1",
    latency: "~20s",
    freeTier: "Yes (OSS)",
    openCore: "No",
    highlight: false,
  },
  {
    name: "Korbit",
    models: "1",
    latency: "~25s",
    freeTier: "Yes",
    openCore: "No",
    highlight: false,
  },
  {
    name: "Bito",
    models: "1",
    latency: "~15s",
    freeTier: "Yes",
    openCore: "No",
    highlight: false,
  },
  {
    name: "PR Sentinel",
    models: "4",
    latency: "~15s",
    freeTier: "V0.1 demo",
    openCore: "Planned",
    highlight: true,
  },
];

const FAQ = [
  {
    q: "Why 4 lenses instead of one?",
    a: "Each lens has a different goal and blind spot. The code-quality lens misses security issues. The security lens misses scope drift. The adversarial lens finds edge cases the others assume away. Running all four in parallel takes the same time as running one.",
  },
  {
    q: "How long does a review take?",
    a: "About 10-20 seconds for most PRs. All 4 lenses run in parallel using async Claude API calls.",
  },
  {
    q: "What model does PR Sentinel use?",
    a: "Claude Sonnet 4.6 for all 4 review lenses. Fast, accurate, and cost-efficient. The aggregation logic is pure Python with no additional LLM calls.",
  },
  {
    q: "Does it read my entire codebase?",
    a: "No. PR Sentinel only sees the unified diff for each PR, the same thing a human reviewer sees. No codebase indexing, no embeddings database.",
  },
  {
    q: "What happens with my code?",
    a: "Diffs are sent to the Claude API and our backend. The raw diff text is NOT stored. We do store: the final verdict, run timestamp, and the four lens summaries plus their must-fix lists. Those summaries may reference function names or lines from your diff, since that is how the lenses describe what they found. Treat anything you paste as discoverable by anyone holding the backend API key. We do not run the diff through any third-party other than Anthropic.",
  },
  {
    q: "What's the status of the GitHub App?",
    a: "V0.1 ships the synchronous review API and the demo UI. The GitHub App webhook pipeline (PR comments, Check Runs) is V0.2 work and is not yet wired. No public timeline. For now, you can paste any diff into the demo and get a real 4-lens review.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🛡</span>
          <span className="font-bold text-xl text-white">PR Sentinel</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-400">
          <Link href="/demo" className="hover:text-white transition-colors">
            Demo
          </Link>
          <a href="#faq" className="hover:text-white transition-colors">
            FAQ
          </a>
          <a
            href="https://github.com/joydai2026-del/pr-sentinel"
            className="bg-white text-gray-950 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-950 text-blue-300 text-sm px-4 py-1.5 rounded-full mb-8 border border-blue-800">
          <span>4 parallel lenses, 1 verdict</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
          Code review that catches what{" "}
          <span className="text-blue-400">one model misses</span>
        </h1>
        <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
          PR Sentinel runs 4 AI reviewers in parallel on every pull request:
          code quality, security, scope reality, and adversarial. Then
          collapses them into one actionable verdict.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/demo"
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            Try the demo
          </Link>
          <a
            href="https://github.com/joydai2026-del/pr-sentinel"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-8 py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            View on GitHub
          </a>
        </div>
        <p className="text-sm text-gray-500 mt-6">
          V0.1: paste-a-diff demo. GitHub App webhook integration is V0.2 work and not yet wired.
        </p>
      </section>

      {/* 4 Lenses */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center text-white mb-12">
          Four independent perspectives on every PR
        </h2>
        <div className="grid grid-cols-2 gap-6">
          {[
            {
              icon: "🔍",
              name: "Code Reviewer",
              desc: "Bugs, style, missing tests, dead code. The classic review done properly.",
            },
            {
              icon: "🔒",
              name: "Security Engineer",
              desc: "Injection, auth bypass, secrets in code, OWASP Top 10. Catches what developers normalize.",
            },
            {
              icon: "🎯",
              name: "Reality Checker",
              desc: "Does the change actually do what the PR claims? Spots hand-waving and fake fixes.",
            },
            {
              icon: "💥",
              name: "Adversarial",
              desc: "Tries to break the code. Edge cases, hidden coupling, race conditions, overflow.",
            },
          ].map((lens) => (
            <div
              key={lens.name}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6"
            >
              <div className="text-3xl mb-3">{lens.icon}</div>
              <h3 className="font-semibold text-white mb-2">{lens.name}</h3>
              <p className="text-gray-400 text-sm">{lens.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Competitor table */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center text-white mb-12">
          Why not CodeRabbit / Greptile / Bito?
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Product</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Review models</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Latency</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Free tier</th>
                <th className="text-center py-3 px-4 text-gray-400 font-medium">Open-core</th>
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((c) => (
                <tr
                  key={c.name}
                  className={`border-b border-gray-800 ${c.highlight ? "bg-blue-950/30" : ""}`}
                >
                  <td className="py-3 px-4 font-medium text-white">
                    {c.name}
                    {c.highlight && (
                      <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        you are here
                      </span>
                    )}
                  </td>
                  <td className={`py-3 px-4 text-center ${c.highlight ? "text-blue-400 font-bold" : "text-gray-400"}`}>
                    {c.models}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-400">{c.latency}</td>
                  <td className="py-3 px-4 text-center text-gray-400">{c.freeTier}</td>
                  <td className="py-3 px-4 text-center text-gray-400">{c.openCore}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center text-white mb-12">FAQ</h2>
        <div className="space-y-6">
          {FAQ.map((item) => (
            <div key={item.q} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="font-semibold text-white mb-2">{item.q}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 text-center py-8 text-gray-500 text-sm">
        <p>PR Sentinel v0.1. Built with Claude Sonnet 4.6 + FastAPI + Next.js</p>
        <p className="mt-1">
          <Link href="/demo" className="hover:text-gray-300 underline">
            Try the demo
          </Link>
        </p>
      </footer>
    </div>
  );
}
