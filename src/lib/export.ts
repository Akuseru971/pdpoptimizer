import { ExportPayload, PreviewPdpModel } from "@/types/pdp";

function toDataUri(content: string, mime = "text/plain;charset=utf-8") {
  return `data:${mime},${encodeURIComponent(content)}`;
}

function downloadTextFile(fileName: string, content: string, mime?: string) {
  const link = document.createElement("a");
  link.href = toDataUri(content, mime);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function buildExportPayload(model: PreviewPdpModel): ExportPayload {
  const summary = [
    `Overall PDP Score: ${model.audit.overall}/100`,
    `Optimized Title: ${model.titleSuggestion.optimizedTitle}`,
    `Image Concepts: ${model.imageConcepts.length}`,
    `Public Contact: ${model.contactResult.publicEmail ?? "No public email found"}`,
  ].join("\n");

  const creativeBrief = [
    `Product: ${model.product.productName}`,
    `Brand: ${model.product.brand}`,
    "",
    "Visual Strategy:",
    ...model.imageConcepts.map(
      (concept, index) => `${index + 1}. ${concept.title} - ${concept.creativeBrief}`,
    ),
  ].join("\n");

  return {
    generatedAt: new Date().toISOString(),
    referenceUrl: model.product.amazonUrl,
    previewModel: model,
    summary,
    creativeBrief,
  };
}

export function exportJson(payload: ExportPayload) {
  downloadTextFile(
    "pdp-optimizer-summary.json",
    JSON.stringify(payload, null, 2),
    "application/json;charset=utf-8",
  );
}

export function exportReport(payload: ExportPayload) {
  const content = [
    "PDP Optimizer Report",
    "====================",
    `Generated at: ${payload.generatedAt}`,
    `Reference URL: ${payload.referenceUrl}`,
    "",
    "Summary",
    "-------",
    payload.summary,
    "",
    "Diagnosis",
    "---------",
    ...payload.previewModel.audit.diagnosis.map((item) => `- ${item}`),
    "",
    "Title Notes",
    "-----------",
    ...payload.previewModel.titleSuggestion.notes.map((item) => `- ${item}`),
  ].join("\n");

  downloadTextFile("pdp-optimizer-report.txt", content);
}

export function exportCreativeBrief(payload: ExportPayload) {
  downloadTextFile("pdp-optimizer-creative-brief.txt", payload.creativeBrief);
}

export async function copyAllToClipboard(payload: ExportPayload) {
  const combined = [
    "PDP Optimizer Export",
    JSON.stringify(payload, null, 2),
    "",
    payload.creativeBrief,
  ].join("\n");

  await navigator.clipboard.writeText(combined);
}
