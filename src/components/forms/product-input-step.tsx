"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PRODUCT_CATEGORIES, TITLE_STYLES } from "@/constants/options";
import { extractAsin, isAmazonUrl } from "@/lib/asin";
import { usePdpStore } from "@/hooks/use-pdp-store";
import { InputImage, ProductInput } from "@/types/pdp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

// ─── helpers ──────────────────────────────────────────────────────────────────

function toInputImage(file: File): InputImage {
  return {
    id: crypto.randomUUID(),
    name: file.name,
    url: URL.createObjectURL(file),
    source: "upload",
  };
}

function parseImageUrlList(value: string) {
  return value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((url) => /^https?:\/\//.test(url));
}

type FetchStatus = "idle" | "loading" | "success" | "warning" | "error";

type AutoFilledFields = Set<keyof ProductInput>;

// ─── auto-fill banner ─────────────────────────────────────────────────────────

function AutoFillBanner({
  status,
  message,
  filledCount,
}: {
  status: FetchStatus;
  message: string;
  filledCount: number;
}) {
  if (status === "idle") return null;

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-200">
        <Loader2 className="h-4 w-4 animate-spin" />
        Detecting product information from URL…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
        <AlertCircle className="h-4 w-4 shrink-0" />
        {message}
      </div>
    );
  }

  if (status === "warning") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>
        <strong>{filledCount} fields auto-filled</strong> — {message}. You can edit any value below.
      </span>
    </div>
  );
}

// ─── labelled field with auto-fill badge ──────────────────────────────────────

function FieldLabel({
  label,
  autoFilled,
}: {
  label: string;
  autoFilled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium">{label}</label>
      {autoFilled && (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <Sparkles className="h-2.5 w-2.5" /> Auto-filled
        </span>
      )}
    </div>
  );
}

// ─── component ───────────────────────────────────────────────────────────────

export function ProductInputStep() {
  const { input, updateField, setInput, resetToDemo } = usePdpStore();
  const [imageUrlText, setImageUrlText] = useState(input.imageUrls.join("\n"));
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [fetchMessage, setFetchMessage] = useState("");
  const [autoFilledFields, setAutoFilledFields] = useState<AutoFilledFields>(new Set());
  // keep the last URL that was auto-fetched to debounce duplicate calls
  const lastFetchedUrl = useRef<string>("");
  const detectedUrlImages = useMemo(
    () => input.images.filter((img) => img.source === "url"),
    [input.images],
  );

  const allImagesPreview = useMemo(
    () => [...input.images.map((image) => image.url), ...input.imageUrls],
    [input.images, input.imageUrls],
  );

  const af = (key: keyof ProductInput) => autoFilledFields.has(key);

  // ── auto-detect when a valid Amazon URL with ASIN is pasted ─────────────────
  async function handleUrlChange(url: string) {
    updateField("amazonUrl", url);

    const asin = extractAsin(url);
    if (!asin || !isAmazonUrl(url) || url === lastFetchedUrl.current) return;

    lastFetchedUrl.current = url;
    setFetchStatus("loading");
    setAutoFilledFields(new Set());

    try {
      const res = await fetch("/api/parse-pdp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const payload = await res.json();

      if (!res.ok || !payload.ok) {
        setFetchStatus("error");
        setFetchMessage(payload.error ?? "Could not detect product info for this URL.");
        return;
      }

      const data: Partial<ProductInput> = payload.data ?? {};
      const filled = new Set<keyof ProductInput>();

      // Apply each detected field to the store
      const updatedInput: ProductInput = { ...input, amazonUrl: url };

      function applyField<K extends keyof ProductInput>(key: K, value: ProductInput[K] | undefined) {
        if (value !== undefined && value !== null && value !== "") {
          (updatedInput as Record<K, ProductInput[K]>)[key] = value;
          filled.add(key);
        }
      }

      applyField("productName", data.productName);
      applyField("brand", data.brand);
      applyField("sellerName", data.sellerName);
      applyField("category", data.category);
      applyField("price", data.price);
      applyField("rating", data.rating);
      applyField("description", data.description);
      applyField("optionalWebsiteOrCompany", data.optionalWebsiteOrCompany);

      if (data.bulletPoints?.length) {
        updatedInput.bulletPoints = data.bulletPoints;
        filled.add("bulletPoints");
      }

      if (data.imageUrls?.length) {
        // Store the raw URLs for the text field
        updatedInput.imageUrls = data.imageUrls;
        filled.add("imageUrls");
        setImageUrlText(data.imageUrls.join("\n"));

        // Also convert to InputImage objects so they show immediately in the visual grid.
        // Any previously auto-detected images (source:"url") are replaced; uploads are kept.
        const userUploads = input.images.filter((img) => img.source === "upload");
        const detectedImages: InputImage[] = data.imageUrls.map((url, i) => ({
          id: `detected-${Date.now()}-${i}`,
          name: `Detected image ${i + 1}`,
          url,
          source: "url" as const,
        }));
        updatedInput.images = [...userUploads, ...detectedImages];
        filled.add("images");
      }

      setInput(updatedInput);
      setAutoFilledFields(filled);

      if (payload.warning) {
        setFetchStatus("warning");
        setFetchMessage(payload.warning);
      } else {
        setFetchStatus("success");
        setFetchMessage(payload.source ?? "Product information detected");
      }
    } catch {
      setFetchStatus("error");
      setFetchMessage("Network error while fetching product data.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1 - Product Input</CardTitle>
        <CardDescription>
          Paste an Amazon PDP URL — fields are detected automatically. No HTML scraping is performed.
          A product data API or mock catalog is used server-side.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* ── URL field + auto-fill banner ── */}
        <div className="mb-5 space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amazon PDP URL</label>
            <div className="relative">
              <Input
                value={input.amazonUrl}
                onChange={(e) => void handleUrlChange(e.target.value)}
                placeholder="https://www.amazon.com/dp/B0XXXXXXXX"
                className={
                  fetchStatus === "loading"
                    ? "border-cyan-400 pr-9 ring-2 ring-cyan-300/40"
                    : fetchStatus === "success"
                      ? "border-emerald-400 pr-9 ring-2 ring-emerald-300/40"
                      : fetchStatus === "error"
                        ? "border-red-400 pr-9 ring-2 ring-red-300/40"
                        : ""
                }
              />
              {fetchStatus === "loading" && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-cyan-500" />
              )}
              {fetchStatus === "success" && (
                <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
              )}
              {fetchStatus === "error" && (
                <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500" />
              )}
            </div>
          </div>
          <AutoFillBanner
            status={fetchStatus}
            message={fetchMessage}
            filledCount={autoFilledFields.size}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel label="Current Product Title" autoFilled={af("productName")} />
            <Input
              value={input.productName}
              onChange={(event) => updateField("productName", event.target.value)}
              placeholder="Current listing title"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel label="Brand" autoFilled={af("brand")} />
            <Input value={input.brand} onChange={(event) => updateField("brand", event.target.value)} placeholder="Brand" />
          </div>
          <div className="space-y-2">
            <FieldLabel label="Seller Name" autoFilled={af("sellerName")} />
            <Input
              value={input.sellerName}
              onChange={(event) => updateField("sellerName", event.target.value)}
              placeholder="Seller"
            />
          </div>
          <div className="space-y-2">
            <FieldLabel label="Category" autoFilled={af("category")} />
            <Select
              value={input.category}
              onChange={(event) => updateField("category", event.target.value)}
              options={PRODUCT_CATEGORIES.map((value) => ({ value, label: value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <FieldLabel label="Price" autoFilled={af("price")} />
              <Input
                type="number"
                min={0}
                step={0.01}
                value={input.price}
                onChange={(event) => updateField("price", Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel label="Rating" autoFilled={af("rating")} />
              <Input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={input.rating}
                onChange={(event) => updateField("rating", Number(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel label="Bullet Points" autoFilled={af("bulletPoints")} />
            <div className="space-y-2">
              {input.bulletPoints.map((point, index) => (
                <div key={`bullet-${index}`} className="flex items-center gap-2">
                  <Input
                    value={point}
                    onChange={(event) => {
                      const bullets = [...input.bulletPoints];
                      bullets[index] = event.target.value;
                      updateField("bulletPoints", bullets);
                    }}
                    placeholder={`Bullet ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (input.bulletPoints.length === 1) return;
                      updateField(
                        "bulletPoints",
                        input.bulletPoints.filter((_, pointer) => pointer !== index),
                      );
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateField("bulletPoints", [...input.bulletPoints, ""])}
            >
              <Plus className="h-4 w-4" /> Add bullet
            </Button>
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel label="Product Description" autoFilled={af("description")} />
            <Textarea
              value={input.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Describe material, usage context, size, and value proposition."
            />
          </div>

          {/* ── Detected images ── */}
          {detectedUrlImages.length > 0 && (
            <div className="space-y-3 md:col-span-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Detected Images from Amazon</label>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" /> Auto-detected
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {detectedUrlImages.map((img, index) => (
                  <div
                    key={img.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
                  >
                    <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                      <img
                        src={img.url}
                        alt={img.name}
                        className="h-52 w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateField(
                            "images",
                            input.images.filter((i) => i.id !== img.id),
                          )
                        }
                        className="absolute right-2 top-2 rounded-full bg-zinc-900/70 p-1 text-white"
                        aria-label="Remove detected image"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Image URL {index + 1}
                      </p>
                      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                        <p className="truncate" title={img.url}>
                          {img.url}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(img.url, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Open
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await navigator.clipboard.writeText(img.url);
                            setCopiedUrl(img.id);
                            setTimeout(() => setCopiedUrl(null), 1200);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          {copiedUrl === img.id ? "Copied" : "Copy URL"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Existing Image Upload (Multiple)</label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-sm text-zinc-600 transition hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <ImagePlus className="h-6 w-6" />
              Drop image files or click to upload
              <input
                type="file"
                className="hidden"
                accept="image/*"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  if (!files.length) return;
                  updateField("images", [...input.images, ...files.map(toInputImage)]);
                }}
              />
            </label>
          </div>

          <div className="space-y-2 md:col-span-2">
            <FieldLabel label="Optional Image URL List" autoFilled={af("imageUrls")} />
            <Textarea
              value={imageUrlText}
              onChange={(event) => {
                setImageUrlText(event.target.value);
                updateField("imageUrls", parseImageUrlList(event.target.value));
              }}
              placeholder="One URL per line"
            />
          </div>

          <div className="space-y-2">
            <FieldLabel label="Optional Website / Company" autoFilled={af("optionalWebsiteOrCompany")} />
            <Input
              value={input.optionalWebsiteOrCompany}
              onChange={(event) => updateField("optionalWebsiteOrCompany", event.target.value)}
              placeholder="company.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Target Style</label>
            <Select
              value={input.targetStyle}
              onChange={(event) => updateField("targetStyle", event.target.value as typeof input.targetStyle)}
              options={TITLE_STYLES.map((value) => ({
                value,
                label: value.charAt(0).toUpperCase() + value.slice(1),
              }))}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={resetToDemo}>
            <RefreshCw className="h-4 w-4" /> Load Demo Product
          </Button>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Total images in analysis: <span className="font-semibold">{allImagesPreview.length}</span>
          </p>
        </div>

        {allImagesPreview.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {allImagesPreview.map((image, index) => (
              <img
                key={`${image}-${index}`}
                src={image}
                alt={`Preview ${index + 1}`}
                className="aspect-square w-full rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
