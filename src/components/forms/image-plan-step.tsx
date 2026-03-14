"use client";

import { ImageUp } from "lucide-react";
import { buildImageConcepts } from "@/lib/image-strategy";
import { usePdpStore } from "@/hooks/use-pdp-store";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ImagePlanStep() {
  const input = usePdpStore((state) => state.input);
  const concepts = buildImageConcepts(input);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 4 - Image Improvement Plan</CardTitle>
        <CardDescription>
          Simulated image generation planning. Structured concept cards are produced for each uploaded image and 3 new concepts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-2">
          {concepts.map((concept) => (
            <div key={concept.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="font-semibold">{concept.title}</h4>
                <Badge variant={concept.safetyTag === "Amazon-safe" ? "success" : "warning"}>{concept.safetyTag}</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium text-zinc-500">Role:</span> {concept.recommendedRole}
                </p>
                <p>
                  <span className="font-medium text-zinc-500">Conversion intent:</span> {concept.conversionIntent}
                </p>
                <p>
                  <span className="font-medium text-zinc-500">Premium direction:</span> {concept.premiumVisualDirection}
                </p>
                <p>
                  <span className="font-medium text-zinc-500">Creative brief:</span> {concept.creativeBrief}
                </p>
                {concept.overlayText && (
                  <p>
                    <span className="font-medium text-zinc-500">Suggested overlay text:</span> {concept.overlayText}
                  </p>
                )}
                <ul className="space-y-1 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-800/50">
                  {concept.improvementRecommendations.map((item) => (
                    <li key={item}>- {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {concepts.length === 0 && (
          <div className="mt-2 rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
            <ImageUp className="mx-auto mb-2 h-7 w-7" />
            Upload at least one image in Step 1 to generate role-based concepts.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
