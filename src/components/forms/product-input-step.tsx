"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Plus, RefreshCw, Trash2 } from "lucide-react";
import { PRODUCT_CATEGORIES, TITLE_STYLES } from "@/constants/options";
import { usePdpStore } from "@/hooks/use-pdp-store";
import { InputImage } from "@/types/pdp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

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

export function ProductInputStep() {
  const { input, updateField, resetToDemo } = usePdpStore();
  const [imageUrlText, setImageUrlText] = useState(input.imageUrls.join("\n"));

  const allImagesPreview = useMemo(
    () => [...input.images.map((image) => image.url), ...input.imageUrls],
    [input.images, input.imageUrls],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1 - Product Input</CardTitle>
        <CardDescription>
          Manual entry only. No Amazon scraping is used. URL is stored as a reference for your exported report.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Amazon PDP URL</label>
            <Input
              value={input.amazonUrl}
              onChange={(event) => updateField("amazonUrl", event.target.value)}
              placeholder="https://www.amazon.com/dp/..."
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Product Title</label>
            <Input
              value={input.productName}
              onChange={(event) => updateField("productName", event.target.value)}
              placeholder="Current listing title"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Brand</label>
            <Input value={input.brand} onChange={(event) => updateField("brand", event.target.value)} placeholder="Brand" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Seller Name</label>
            <Input
              value={input.sellerName}
              onChange={(event) => updateField("sellerName", event.target.value)}
              placeholder="Seller"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select
              value={input.category}
              onChange={(event) => updateField("category", event.target.value)}
              options={PRODUCT_CATEGORIES.map((value) => ({ value, label: value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Price</label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={input.price}
                onChange={(event) => updateField("price", Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating</label>
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
            <label className="text-sm font-medium">Bullet Points</label>
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
            <label className="text-sm font-medium">Product Description</label>
            <Textarea
              value={input.description}
              onChange={(event) => updateField("description", event.target.value)}
              placeholder="Describe material, usage context, size, and value proposition."
            />
          </div>

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
            <label className="text-sm font-medium">Optional Image URL List</label>
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
            <label className="text-sm font-medium">Optional Website / Company</label>
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
