import { BarChart3, Layers3, Sparkles } from "lucide-react";
import { WorkflowShell } from "@/components/workflow/workflow-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_10%,#d9f99d_0%,transparent_35%),radial-gradient(circle_at_90%_0%,#a5f3fc_0%,transparent_36%),linear-gradient(120deg,#f8fafc_10%,#f1f5f9_50%,#ecfeff_100%)] text-zinc-900 dark:bg-[radial-gradient(circle_at_20%_10%,#14532d_0%,transparent_40%),radial-gradient(circle_at_90%_0%,#164e63_0%,transparent_40%),linear-gradient(120deg,#09090b_15%,#111827_55%,#082f49_100%)] dark:text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.4)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.3)_1px,transparent_1px)] bg-[size:22px_22px] opacity-30 dark:opacity-10" />

      <header className="sticky top-0 z-20 border-b border-white/50 bg-white/70 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-zinc-900 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <Layers3 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">SaaS Workflow</p>
              <h1 className="text-lg font-semibold leading-none">PDP Optimizer</h1>
            </div>
          </div>
          <Badge variant="secondary">Manual Input Only • No Scraping</Badge>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl space-y-8 px-4 py-8 md:px-6 md:py-12">
        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card className="border-emerald-200/70 bg-white/80 dark:border-emerald-900/50 dark:bg-zinc-900/70">
            <CardContent className="space-y-4">
              <Badge variant="success">MVP Ready</Badge>
              <h2 className="max-w-3xl text-3xl font-semibold leading-tight md:text-4xl">
                Analyze weak Amazon PDP content, then generate a stronger conversion-ready concept listing.
              </h2>
              <p className="max-w-3xl text-zinc-600 dark:text-zinc-300">
                Enter product data manually, score quality with deterministic heuristics, optimize title structure, create premium image concept plans, find public business contacts, preview before/after, and export all deliverables.
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardContent className="flex items-start gap-3">
                <BarChart3 className="mt-1 h-5 w-5 text-cyan-500" />
                <div>
                  <p className="font-semibold">Deterministic Audit Engine</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">Transparent scoring with explicit rules and diagnosis output.</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-start gap-3">
                <Sparkles className="mt-1 h-5 w-5 text-emerald-500" />
                <div>
                  <p className="font-semibold">Premium Creative Strategy</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">Structured image concept planning and conversion-focused title variants.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <WorkflowShell />

        <section className="rounded-2xl border border-zinc-200 bg-white/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <details>
            <summary className="cursor-pointer text-sm font-semibold">How scoring works</summary>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Title quality uses length, repetition, and format checks. Image quality uses visual coverage counts. Conversion measures bullet density and benefit language. Trust and completeness depend on brand, seller, rating, and mandatory listing fields.
            </p>
          </details>
        </section>
      </main>
    </div>
  );
}
