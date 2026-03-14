"use client";

import { useMemo, useState } from "react";
import { ClipboardCopy, Download, FileJson, FileText, Loader2 } from "lucide-react";
import { usePdpStore } from "@/hooks/use-pdp-store";
import { auditProductInput } from "@/lib/scoring";
import { generateTitleSuggestion } from "@/lib/title-optimizer";
import { buildImageConcepts } from "@/lib/image-strategy";
import { buildExportPayload, copyAllToClipboard, exportCreativeBrief, exportJson, exportReport } from "@/lib/export";
import { ContactResult, PreviewPdpModel } from "@/types/pdp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const fallbackContact: ContactResult = {
  detectedEntityName: "Unknown entity",
  entityType: "unknown",
  officialWebsite: null,
  publicEmail: null,
  alternativeContactPath: "No public email found",
  sourceLabel: "Export fallback",
  confidence: "low",
  confidenceScore: 10,
  explanation: "Contact lookup was not completed before export.",
};

export function ExportStep() {
  const input = usePdpStore((state) => state.input);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const baseModel = useMemo(
    () => ({
      product: input,
      audit: auditProductInput(input),
      titleSuggestion: generateTitleSuggestion(input),
      imageConcepts: buildImageConcepts(input),
    }),
    [input],
  );

  async function getModel(): Promise<PreviewPdpModel> {
    setLoading(true);
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json();
      return {
        ...baseModel,
        contactResult: response.ok ? (payload.result as ContactResult) : fallbackContact,
      };
    } catch {
      return { ...baseModel, contactResult: fallbackContact };
    } finally {
      setLoading(false);
    }
  }

  async function runExport(kind: "json" | "report" | "brief" | "copy") {
    const model = await getModel();
    const payload = buildExportPayload(model);

    if (kind === "json") {
      exportJson(payload);
      setMessage("JSON summary downloaded.");
      return;
    }

    if (kind === "report") {
      exportReport(payload);
      setMessage("Text report downloaded.");
      return;
    }

    if (kind === "brief") {
      exportCreativeBrief(payload);
      setMessage("Creative brief downloaded.");
      return;
    }

    await copyAllToClipboard(payload);
    setMessage("Full export copied to clipboard.");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 7 - Export</CardTitle>
        <CardDescription>
          Download structured outputs for handoff: JSON summary, text report, and creative brief. PDF can be added later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Button onClick={() => void runExport("json")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />} JSON Summary
          </Button>
          <Button variant="outline" onClick={() => void runExport("report")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Text Report
          </Button>
          <Button variant="outline" onClick={() => void runExport("brief")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Creative Brief
          </Button>
          <Button variant="secondary" onClick={() => void runExport("copy")} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCopy className="h-4 w-4" />} Copy All
          </Button>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
          <p>Includes optimized title, image strategy, diagnostics, trust notes, and contact lookup context.</p>
          {message && <p className="mt-2 font-medium">{message}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
