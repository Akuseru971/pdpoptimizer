"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Sparkle } from "lucide-react";
import { usePdpStore } from "@/hooks/use-pdp-store";
import { auditProductInput } from "@/lib/scoring";
import { buildImageConcepts } from "@/lib/image-strategy";
import { generateTitleSuggestion } from "@/lib/title-optimizer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function ProductVisualRail({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const safeImages = images.length ? images : ["https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=1200&q=80"];

  return (
    <div className="grid gap-3 md:grid-cols-[72px_1fr]">
      <div className="order-2 flex gap-2 overflow-auto md:order-1 md:flex-col">
        {safeImages.map((image, index) => (
          <button
            key={`${image}-${index}`}
            onClick={() => setActive(index)}
            className={`overflow-hidden rounded-xl border ${
              active === index ? "border-emerald-500" : "border-zinc-200 dark:border-zinc-700"
            }`}
          >
            <img src={image} alt={`Thumbnail ${index + 1}`} className="h-14 w-14 object-cover" />
          </button>
        ))}
      </div>
      <div className="order-1 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
        <img src={safeImages[active]} alt="Product preview" className="mx-auto aspect-square max-h-[360px] w-full object-contain" />
      </div>
    </div>
  );
}

export function PdpPreviewStep() {
  const input = usePdpStore((state) => state.input);
  const [tab, setTab] = useState<"current" | "improved">("current");

  const audit = useMemo(() => auditProductInput(input), [input]);
  const titleSuggestion = useMemo(() => generateTitleSuggestion(input), [input]);
  const concepts = useMemo(() => buildImageConcepts(input), [input]);

  const sourceImages = [...input.images.map((image) => image.url), ...input.imageUrls];

  const improvedBullets = input.bulletPoints.filter(Boolean).length
    ? input.bulletPoints.filter(Boolean).map((bullet) => `${bullet} - Benefit-focused refinement.`)
    : ["Add bullet points in Step 1 to populate this section."];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Step 6 - Fake PDP Preview</CardTitle>
            <CardDescription>
              Custom preview inspired by PDP structure. Not an Amazon clone and clearly marked as simulation.
            </CardDescription>
          </div>
          <Badge variant="warning">Preview / Concept PDP</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2">
          <Button variant={tab === "current" ? "secondary" : "outline"} onClick={() => setTab("current")}>Current PDP</Button>
          <Button variant={tab === "improved" ? "secondary" : "outline"} onClick={() => setTab("improved")}>Improved PDP</Button>
        </div>

        {tab === "current" ? (
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1.6fr_1fr]">
            <ProductVisualRail images={sourceImages} />
            <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
              <h3 className="text-2xl font-semibold">{input.productName || "Current product title"}</h3>
              <p className="text-sm text-zinc-500">Brand: {input.brand || "-"}</p>
              <p className="text-lg font-bold">${input.price.toFixed(2)}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">Rating: {input.rating}/5</p>
              <ul className="space-y-2 text-sm">
                {input.bulletPoints.filter(Boolean).map((bullet) => (
                  <li key={bullet}>- {bullet}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
              <p className="text-xs uppercase text-zinc-500">Purchase Summary</p>
              <p className="mt-2 text-2xl font-bold">${input.price.toFixed(2)}</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Seller: {input.sellerName || "Unknown"}</p>
              <div className="mt-4 rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
                Baseline trust score: {audit.breakdown.trust}/100
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.2fr_1.6fr_1fr]">
              <ProductVisualRail images={sourceImages} />
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900 dark:bg-emerald-950/20">
                <h3 className="text-2xl font-semibold">{titleSuggestion.optimizedTitle}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">Optimized for readability and conversion clarity.</p>
                <p className="text-lg font-bold">${input.price.toFixed(2)}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">Rating: {Math.max(input.rating, 4.3).toFixed(1)}/5</p>
                <ul className="space-y-2 text-sm">
                  {improvedBullets.map((bullet) => (
                    <li key={bullet}>- {bullet}</li>
                  ))}
                </ul>
                <div className="rounded-xl bg-white/90 p-3 text-sm dark:bg-zinc-900/70">
                  <p className="mb-1 flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                    <Sparkle className="h-4 w-4" /> Conversion notes
                  </p>
                  <p>Benefit-forward structure and clearer visual role sequencing improve first-impression confidence.</p>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900/50">
                <p className="text-xs uppercase text-zinc-500">Purchase Summary</p>
                <p className="mt-2 text-2xl font-bold">${input.price.toFixed(2)}</p>
                <div className="mt-3 rounded-xl bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
                  Trust score uplift target: {Math.min(100, audit.breakdown.trust + 15)}/100
                </div>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Seller and support details should be verified before publishing.</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {concepts.slice(0, 3).map((concept) => (
                <div key={concept.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <p className="text-sm font-semibold">{concept.title}</p>
                  <p className="mt-1 text-xs text-zinc-500">{concept.recommendedRole}</p>
                  <p className="mt-3 text-sm">{concept.creativeBrief}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
              <p className="flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" /> Trust notes: add materials, dimensions, and verified support details to reduce hesitation.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
