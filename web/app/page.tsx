import Link from "next/link";

const GITHUB_APP_URL = "https://github.com/apps/pr-sentinel"; // placeholder until App is registered

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
    freeTier: "5 PRs/mo",
    openCore: "Planned",
    highlight: true,
  },
];

const PRICING = [
  {
    tier: "Free",
    price: "$0",
    period: "/mo",
    features: ["5 PRs/month", "4-lens review", "JSON report", "Community support"],
    cta: "Start Free",
    variant: "outline",
  },
  {
    tier: "Solo",
    price: "$19",
    period: "/mo",
    features: [
      "Unlimited PRs",
      "4-lens review",
      "GitHub Check Runs",
      "Email digest",
      "Priority support",
    ],
    cta: "Get Solo",
    variant: "primary",
  },
  {
    tier: "Team",
    price: "$79",
    period: "/mo",
    features: [
      "Up to 10 repos",
      "4-lens review",
      "GitHub Check Runs",
      "Slack notifications",
      "Custom lens config",
      "SLA support",
    ],
    cta: "Get Team",
    variant: "outline",
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
    a: "Claude Sonnet 4.6 for all 4 review lenses — fast, accurate, and cost-efficient. The aggregation logic is pure Python with no additional LLM calls.",
  },
  {
    q: "Does it read my entire codebase?",
    a: "No. PR Sentinel only sees the unified diff for each PR — the same thing a human reviewer sees. No codebase indexing, no embeddings database.",
  },
  {
    q: "What happens with my code?",
    a: "Diffs are sent to the Claude API and our backend. We do not store diffs permanently — only run metadata (verdict, timestamp) is stored.",
  },
  {
    q: "When does the GitHub App support arrive?",
    a: "The GitHub webhook integration is V0.2, coming within 2 weeks. For now, you can use the demo to paste any diff and get a review.",
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
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <a href="#faq" className="hover:text-white transition-colors">
            FAQ
          </a>
          <a
            href={GITHUB_APP_URL}
            className="bg-white text-gray-950 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Add to GitHub
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
          <a
            href={GITHUB_APP_URL}
            className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            Add to GitHub — Free
          </a>
          <Link
            href="/demo"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 px-8 py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            Try the demo
          </Link>
        </div>
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

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-center text-white mb-4">Pricing</h2>
        <p className="text-center text-gray-400 mb-12">
          Start free. Upgrade when you ship more.
        </p>
        <div className="grid grid-cols-3 gap-6">
          {PRICING.map((plan) => (
            <div
              key={plan.tier}
              className={`rounded-xl p-6 flex flex-col ${
                plan.variant === "primary"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-900 border border-gray-800 text-gray-100"
              }`}
            >
              <div className="mb-4">
                <div className="text-sm font-medium opacity-70 mb-1">{plan.tier}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="opacity-70 text-sm">{plan.period}</span>
                </div>
              </div>
              <ul className="flex-1 space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm flex items-center gap-2">
                    <span className="opacity-70">checkmark</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={GITHUB_APP_URL}
                className={`block text-center py-2.5 rounded-lg font-medium transition-colors ${
                  plan.variant === "primary"
                    ? "bg-white text-blue-600 hover:bg-gray-100"
                    : "border border-gray-700 hover:border-gray-500 text-gray-300"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
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
        <p>PR Sentinel v0.1 — Built with Claude Sonnet 4.6 + FastAPI + Next.js</p>
        <p className="mt-1">
          <Link href="/demo" className="hover:text-gray-300 underline">
            Try the demo
          </Link>
        </p>
      </footer>
    </div>
  );
}
