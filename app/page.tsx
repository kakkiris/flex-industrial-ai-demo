import { StatusGrid } from "@/components/shell/StatusGrid";

// Visual revamp 2026-05-27. Home leans into a restrained, editorial look:
// wordmark eyebrow in Plex Mono UPPERCASE, refined h1, clean two-paragraph
// orientation panel, demo grid below. No card chrome wrapping the about
// block, just borders and typography.

export default function HomePage() {
  return (
    <div className="px-8 py-10 max-w-6xl mx-auto">
      <header className="mb-12">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-foreground-muted mb-3">
          FlexOps AI <span className="text-primary mx-0.5">×</span> KFP
        </p>
        <h1 className="text-[34px] font-medium tracking-[-0.02em] leading-[1.15] text-foreground mb-3">
          FlexOps AI Demo Suite
        </h1>
        <p className="text-[15px] leading-relaxed text-foreground-muted max-w-3xl">
          AI workflow demos for a flex industrial operator (fictional client: Keystone Flex Partners). Five proof-of-concept demos spanning acquisitions, leasing, and portfolio operations, built from a discovery synthesis and a published build spec.
        </p>
      </header>

      <section className="mb-12 rounded-md border border-border bg-background-subtle px-6 py-5">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground-muted mb-3">
          About KFP (fictional client)
        </p>
        <div className="space-y-3 text-[13.5px] leading-[1.6] text-foreground-muted max-w-4xl">
          <p>
            Keystone Flex Partners owns and operates multi-tenant flex industrial properties, typically 1,000 to 5,000 sqft units leased to contractors, e-commerce fulfillment, light manufacturing, and distribution tenants. Long-hold strategy, a few dozen operating assets, growing through acquisitions in Marisol and nearby markets.
          </p>
          <p>
            This demo suite covers five audit-prioritized solutions out of the broader roadmap. Each demo is a Next.js route in this app, sharing one SQLite database, one Anthropic client, and one PDF pipeline. All companies, people, properties, and figures shown are fictional and synthetic.
          </p>
        </div>
      </section>

      <section>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-foreground-muted mb-3">
          Demos
        </p>
        <StatusGrid />
      </section>

      <footer className="mt-20 pt-6 border-t border-border">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground-faint">
          FlexOps AI demo suite. Keystone Flex Partners is a fictional client; all data is synthetic.
        </p>
      </footer>
    </div>
  );
}
