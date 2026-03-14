"use client";

import { CheckCircle2, Gauge, TriangleAlert } from "lucide-react";
import { auditProductInput } from "@/lib/scoring";
import { usePdpStore } from "@/hooks/use-pdp-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function scoreTone(score: number) {
  if (score >= 75) return "success" as const;
  if (score >= 50) return "secondary" as const;
  return "warning" as const;
}

export function PdpAuditStep() {
  const input = usePdpStore((state) => state.input);
  const audit = auditProductInput(input);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 2 - PDP Audit</CardTitle>
        <CardDescription>Deterministic scoring engine based on manual listing content and image coverage.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
            <p className="text-sm text-zinc-500">Overall Score</p>
            <p className="mt-1 text-3xl font-bold">{audit.overall}/100</p>
          </div>
          {Object.entries(audit.breakdown).map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <p className="text-sm capitalize text-zinc-500">{key}</p>
                <Badge variant={scoreTone(value)}>{value}</Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900 dark:bg-amber-950/30">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200">
              <TriangleAlert className="h-4 w-4" /> Diagnosis
            </h4>
            <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {audit.diagnosis.map((issue) => (
                <li key={issue} className="rounded-lg bg-white/80 p-2 dark:bg-zinc-900/60">
                  {issue}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h4 className="mb-2 flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="h-4 w-4" /> Strengths
            </h4>
            <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {audit.strengths.map((item) => (
                <li key={item} className="rounded-lg bg-white/80 p-2 dark:bg-zinc-900/60">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-zinc-300">
          <Gauge className="h-4 w-4" />
          Scores are deterministic rules, not AI guesses.
        </div>
      </CardContent>
    </Card>
  );
}
