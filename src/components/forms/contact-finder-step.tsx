"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, MailSearch } from "lucide-react";
import { usePdpStore } from "@/hooks/use-pdp-store";
import { ContactResult } from "@/types/pdp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const fallbackResult: ContactResult = {
  detectedEntityName: "No entity detected",
  entityType: "unknown",
  officialWebsite: null,
  publicEmail: null,
  alternativeContactPath: "No public email found. Verify business channels manually.",
  sourceLabel: "No Lookup Yet",
  confidence: "low",
  confidenceScore: 0,
  explanation: "Run lookup to search for a public business contact.",
};

function badgeVariant(confidence: ContactResult["confidence"]) {
  if (confidence === "high") return "success" as const;
  if (confidence === "medium") return "secondary" as const;
  return "warning" as const;
}

export function ContactFinderStep() {
  const input = usePdpStore((state) => state.input);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContactResult>(fallbackResult);
  const [provider, setProvider] = useState("-");

  async function lookup() {
    setLoading(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Lookup failed");

      setResult(payload.result as ContactResult);
      setProvider(payload.provider as string);
    } catch (error) {
      setResult({
        ...fallbackResult,
        explanation: error instanceof Error ? error.message : "Unknown lookup error",
      });
      setProvider("Error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void lookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 5 - Public Supplier / Brand Contact Finder</CardTitle>
        <CardDescription>
          Provider-based architecture with confidence levels. Never invents email data and clearly separates entity types.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-500">Provider: {provider}</div>
          <Button variant="outline" onClick={lookup} disabled={loading}>
            <MailSearch className="h-4 w-4" /> {loading ? "Searching..." : "Run Lookup"}
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase text-zinc-500">Detected Entity</p>
            <p className="font-semibold">{result.detectedEntityName}</p>
            <p className="text-sm text-zinc-500">Type: {result.entityType}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase text-zinc-500">Confidence</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={badgeVariant(result.confidence)}>{result.confidence}</Badge>
              <span className="text-sm text-zinc-600 dark:text-zinc-300">{result.confidenceScore}/100</span>
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase text-zinc-500">Official Website</p>
            <p className="text-sm font-medium">{result.officialWebsite ?? "No website found"}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
            <p className="text-xs uppercase text-zinc-500">Public Email</p>
            <p className="text-sm font-medium">{result.publicEmail ?? "No public email found"}</p>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
          <p>
            <span className="font-medium">Alternative path:</span> {result.alternativeContactPath}
          </p>
          <p className="mt-1 text-zinc-500">{result.explanation}</p>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> This is a publicly found business contact. Verify the contact before outreach.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
