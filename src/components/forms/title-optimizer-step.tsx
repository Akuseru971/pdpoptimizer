"use client";

import { Sparkles } from "lucide-react";
import { generateTitleSuggestion } from "@/lib/title-optimizer";
import { usePdpStore } from "@/hooks/use-pdp-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TitleOptimizerStep() {
  const input = usePdpStore((state) => state.input);
  const suggestion = generateTitleSuggestion(input);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 3 - Title Optimization</CardTitle>
        <CardDescription>Rules-based title engine with realistic Amazon-friendly structure.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Optimized Title</p>
            <p className="mt-1 font-semibold">{suggestion.optimizedTitle || "Add product details in Step 1"}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Shorter Version</p>
              <p className="mt-1 text-sm">{suggestion.shorterVersion}</p>
            </div>
            <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Conversion-Focused Version</p>
              <p className="mt-1 text-sm">{suggestion.conversionVersion}</p>
            </div>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 dark:border-cyan-900 dark:bg-cyan-950/30">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-800 dark:text-cyan-200">
              <Sparkles className="h-4 w-4" /> What changed
            </p>
            <ul className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
              {suggestion.notes.map((note) => (
                <li key={note}>- {note}</li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
