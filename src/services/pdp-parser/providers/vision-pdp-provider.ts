import OpenAI, { APIError } from "openai";
import { chromium, type Page } from "playwright";
import type { ParsedPdpData, PdpParseResult, PdpParserProvider } from "@/services/pdp-parser/types";

function toDataUrl(buffer: Buffer, mimeType = "image/jpeg"): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.,]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function canonicalizeImageUrl(url: string): string {
  let out = url.trim().replace(/\s+/g, "");
  out = out.replace(/\?.*$/, "").replace(/#.*$/, "");
  if (/media-amazon\.com|images-amazon\.com/i.test(out) && !/\.(jpg|jpeg|png|webp)$/i.test(out)) {
    out = `${out}.jpg`;
  }
  return out;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function firstVisibleLocator(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      try {
        if (await locator.isVisible()) return locator;
      } catch {
        // ignore visibility errors
      }
    }
  }
  return null;
}

async function screenshotLocator(page: Page, selectors: string[]): Promise<string | undefined> {
  const locator = await firstVisibleLocator(page, selectors);
  if (!locator) return undefined;
  try {
    const buffer = await locator.screenshot({ type: "jpeg", quality: 80 });
    return toDataUrl(buffer);
  } catch {
    return undefined;
  }
}

async function captureCarousel(page: Page): Promise<{ imageUrls: string[]; crops: string[] }> {
  const imageUrls: string[] = [];
  const crops: string[] = [];

  const thumbList = page.locator("#altImages li, #imageBlockThumbs li");
  const thumbsCount = await thumbList.count();
  const count = Math.min(thumbsCount, 10);

  const mainImageSelectors = [
    "#landingImage",
    "#imgTagWrapperId img",
    "#main-image-container img",
    "#main-image-container",
  ];

  if (count > 0) {
    for (let i = 0; i < count; i++) {
      const thumb = thumbList.nth(i);
      try {
        await thumb.click({ timeout: 1500 });
      } catch {
        // ignore click issues and continue
      }
      await page.waitForTimeout(250);

      const mainImage = await firstVisibleLocator(page, mainImageSelectors);
      if (mainImage) {
        try {
          const src = await mainImage.getAttribute("src");
          if (src && /^https?:\/\//i.test(src)) imageUrls.push(canonicalizeImageUrl(src));
        } catch {
          // ignore
        }
        try {
          const buffer = await mainImage.screenshot({ type: "jpeg", quality: 82 });
          crops.push(toDataUrl(buffer));
        } catch {
          // ignore
        }
      }
    }
  } else {
    // Fallback to one main image if thumbnails are unavailable.
    const mainImage = await firstVisibleLocator(page, mainImageSelectors);
    if (mainImage) {
      try {
        const src = await mainImage.getAttribute("src");
        if (src && /^https?:\/\//i.test(src)) imageUrls.push(canonicalizeImageUrl(src));
      } catch {
        // ignore
      }
      try {
        const buffer = await mainImage.screenshot({ type: "jpeg", quality: 82 });
        crops.push(toDataUrl(buffer));
      } catch {
        // ignore
      }
    }
  }

  return { imageUrls: unique(imageUrls).slice(0, 30), crops: unique(crops).slice(0, 12) };
}

export class VisionPdpParserProvider implements PdpParserProvider {
  name = "VisionPdpParserProvider";

  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async parse(asin: string, amazonDomain: string): Promise<PdpParseResult> {
    const productUrl = `https://www.${amazonDomain}/dp/${asin}`;
    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 2400 },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        locale: "en-US",
      });
      const page = await context.newPage();

      await page.goto(productUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1200);

      const bodyText = (await page.locator("body").innerText()).slice(0, 12000);

      // Capture key PDP sections for vision extraction.
      const titleShot = await screenshotLocator(page, ["#titleSection", "#productTitle", "#dp"]).catch(() => undefined);
      const buyBoxShot = await screenshotLocator(page, ["#desktop_buybox", "#buybox", "#exports_desktop_qualifiedBuyBox"]).catch(() => undefined);
      const bulletsShot = await screenshotLocator(page, ["#feature-bullets", "#featurebullets_feature_div"]).catch(() => undefined);
      const detailsShot = await screenshotLocator(page, ["#productDetails_detailBullets_sections1", "#detailBullets_feature_div", "#prodDetails"]).catch(() => undefined);
      const carousel = await captureCarousel(page);

      const content: Array<Record<string, unknown>> = [
        {
          type: "text",
          text: [
            "Extract Amazon PDP fields as JSON with exact keys:",
            "productName, brand, sellerName, category, price, rating, bulletPoints, description, imageUrls",
            "Rules: do not invent, output JSON only, omit unknown fields.",
            `ASIN: ${asin}`,
            `URL: ${productUrl}`,
            "Visible page text:",
            bodyText,
          ].join("\n\n"),
        },
      ];

      for (const shot of [titleShot, buyBoxShot, bulletsShot, detailsShot, ...carousel.crops.slice(0, 6)]) {
        if (!shot) continue;
        content.push({
          type: "image_url",
          image_url: { url: shot },
        });
      }

      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You map Amazon product pages from text and screenshots into strict JSON with the exact requested keys only.",
          },
          {
            role: "user",
            // openai typing for multimodal arrays is strict; runtime supports this shape.
            content: content as never,
          },
        ],
      });

      const raw = JSON.parse(completion.choices[0].message.content ?? "{}") as Record<string, unknown>;
      const data: ParsedPdpData = {
        productName: typeof raw.productName === "string" ? raw.productName : undefined,
        brand: typeof raw.brand === "string" ? raw.brand : undefined,
        sellerName: typeof raw.sellerName === "string" ? raw.sellerName : undefined,
        category: typeof raw.category === "string" ? raw.category : undefined,
        price: toNumber(raw.price),
        rating: toNumber(raw.rating),
        bulletPoints: Array.isArray(raw.bulletPoints)
          ? raw.bulletPoints.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
          : undefined,
        description: typeof raw.description === "string" ? raw.description : undefined,
        // Prefer true carousel URLs. If unavailable, fallback to cropped screenshots so previews stay usable.
        imageUrls: carousel.imageUrls.length ? carousel.imageUrls : carousel.crops,
      };

      return {
        ok: true,
        asin,
        source: "Vision (screenshots + OpenAI)",
        data,
      };
    } catch (error) {
      if (error instanceof APIError && error.code === "insufficient_quota") {
        return {
          ok: false,
          asin,
          source: "Vision",
          data: {},
          error: error.message,
          quotaExceeded: true,
        };
      }
      return {
        ok: false,
        asin,
        source: "Vision",
        data: {},
        error: error instanceof Error ? error.message : "Vision parsing failed",
      };
    } finally {
      await browser.close();
    }
  }
}
