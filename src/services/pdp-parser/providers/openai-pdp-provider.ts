import OpenAI, { APIError } from "openai";
import type { PdpParserProvider, PdpParseResult, ParsedPdpData } from "@/services/pdp-parser/types";

// ─── HTML helpers ─────────────────────────────────────────────────────────────

/**
 * Extracts the most data-rich sections of an Amazon product page HTML.
 * We avoid sending the full page (>500 KB) to the LLM.
 */
function extractRelevantHtml(html: string): string {
  const chunks: string[] = [];

  // Well-known Amazon element IDs that contain product information
  const targetIds = [
    "productTitle",
    "feature-bullets",
    "featurebullets_feature_div",
    "priceblock_ourprice",
    "priceblock_dealprice",
    "price_inside_buybox",
    "corePrice_desktop",
    "averageCustomerReviews",
    "productDescription",
    "aplus",
    "imageBlock",
    "dp-container",
    "ppd",
  ];

  for (const id of targetIds) {
    const marker = `id="${id}"`;
    const idx = html.indexOf(marker);
    if (idx === -1) continue;
    // Walk back to the opening tag
    const open = html.lastIndexOf("<", idx);
    // Grab a generous 3 000-char window (enough for bullets/description)
    const snippet = html.slice(open, open + 3000);
    chunks.push(snippet);
  }

  return chunks.join("\n\n") || html.slice(0, 12000);
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an Amazon product data extraction assistant.
Your task is to extract structured product information from either:
  (a) raw Amazon product page HTML provided by the user, or
  (b) your own training knowledge when only an ASIN or URL is given.

Return ONLY a valid JSON object with the following keys (omit any field you cannot determine with confidence):
{
  "productName":  "Full product title as shown on Amazon",
  "brand":        "Brand / manufacturer name",
  "sellerName":   "Sold-by seller name (often same as brand)",
  "category":     "Top-level product category",
  "price":        29.99,
  "rating":       4.5,
  "bulletPoints": ["Key feature 1", "Key feature 2", "..."],
  "description":  "Full product description paragraph",
  "imageUrls":    ["https://example.com/image1.jpg", "..."]
}

Rules:
- price and rating must be numbers, not strings.
- bulletPoints must be a flat array of plain strings (no leading "–" or "•").
- imageUrls must be absolute HTTPS URLs. Prefer hi-res Amazon CDN URLs (images-amazon.com).
- Do NOT invent data. If a field is unknown, omit it.`;

const FIELD_MAPPING_PROMPT = `Field mapping rules (CRITICAL):
- productName: ONLY the listing title (Amazon title / productTitle). Never put brand-only text here.
- brand: Brand/manufacturer only. Do not include "Visit the ... Store" wrappers.
- sellerName: The "Sold by" merchant. If unavailable, you may fallback to brand.
- category: Product category path top node (e.g. "Home & Kitchen"). Not a bullet point.
- price: Current final displayed price (buy box/deal/current), numeric decimal only.
- rating: Average star rating out of 5, numeric only (e.g. 4.4).
- bulletPoints: Key feature bullets only (3-7 preferred), no duplicates, no marketing fluff.
- description: Long-form description / A+ text summary. Do not copy the title or bullets verbatim.
- imageUrls: Product gallery image URLs only. Exclude logos, icons, ads, and sprite sheets.

Output constraints:
- Return JSON object only.
- Use EXACT key names: productName, brand, sellerName, category, price, rating, bulletPoints, description, imageUrls.
- If unsure, omit the field instead of guessing.`;

function pickFirstString(raw: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function pickFirstArray(raw: Record<string, unknown>, keys: string[]): unknown[] | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.,]/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeBulletPoints(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const bullets = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .map((item) => item.replace(/^[\-•–\*\s]+/, "").trim())
    .filter(Boolean);
  return bullets.length ? Array.from(new Set(bullets)).slice(0, 10) : undefined;
}

function normalizeImageUrls(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((url) => /^https:\/\//i.test(url))
    .filter((url) => !/sprite|icon|logo|spacer/i.test(url));
  return urls.length ? Array.from(new Set(urls)).slice(0, 20) : undefined;
}

function extractAmazonImageUrlsFromHtml(html: string): string[] {
  const found = new Set<string>();

  // Direct image URLs in HTML attributes.
  const attrPattern = /https:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:[^\s"'<>]*)/gi;
  for (const match of html.matchAll(attrPattern)) {
    const candidate = (match[0] ?? "").trim();
    if (!candidate) continue;
    if (!/images[-.]amazon\.com|media-amazon\.com/i.test(candidate)) continue;
    if (/sprite|icon|logo|spacer/i.test(candidate)) continue;
    found.add(candidate.replace(/\._[^.]+\./, "."));
  }

  // JSON-embedded image objects (hiRes/large/mainUrl keys are common on Amazon PDP).
  const jsonKeyPattern = new RegExp(
    '"(?:hiRes|large|mainUrl|thumb|variant)"\\s*:\\s*"(https:\\\\/\\\\/[^\\"]+)"',
    "gi",
  );
  for (const match of html.matchAll(jsonKeyPattern)) {
    const candidate = (match[1] ?? "").replace(/\\\//g, "/").trim();
    if (!candidate) continue;
    if (!/images[-.]amazon\.com|media-amazon\.com/i.test(candidate)) continue;
    if (/sprite|icon|logo|spacer/i.test(candidate)) continue;
    found.add(candidate.replace(/\._[^.]+\./, "."));
  }

  return Array.from(found).slice(0, 30);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class OpenAIPdpParserProvider implements PdpParserProvider {
  name = "OpenAIPdpParserProvider";

  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async parse(asin: string, amazonDomain: string): Promise<PdpParseResult> {
    const productUrl = `https://www.${amazonDomain}/dp/${asin}`;
    let htmlContent = "";
    let htmlRaw = "";
    let source = "OpenAI (from training data)";

    // ── Step 1: attempt server-side fetch ─────────────────────────────────────
    try {
      const resp = await fetch(productUrl, {
        headers: {
          // Mimic a real browser request to reduce bot detection
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(10_000),
        // Do not cache aggressively on the CDN layer
        cache: "no-store",
      });

      if (resp.ok) {
        const html = await resp.text();
        htmlRaw = html;
        // If Amazon returned a CAPTCHA page, skip the HTML
        const isCaptcha =
          html.includes("Type the characters you see in this image") ||
          html.includes("api.cer.amazon.com") ||
          html.includes("robot check");

        if (!isCaptcha) {
          htmlContent = extractRelevantHtml(html);
          source = "OpenAI + Amazon page (live fetch)";
        }
      }
    } catch {
      // Fetch failed (timeout, network error, etc.) — fall through to ASIN-only mode
    }

    // ── Step 2: ask GPT-4o-mini to extract structured data (with retry) ────────
    const userMessage = htmlContent
      ? `Extract product information from the following Amazon product page HTML (ASIN: ${asin}):\n\n${htmlContent.slice(0, 14_000)}`
      : `Extract product information for the Amazon product with ASIN "${asin}" sold on ${amazonDomain}.\nProduct URL: ${productUrl}\nUse your knowledge about this product if available.`;

    const MAX_RETRIES = 3;
    let lastError: unknown;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0,
          messages: [
            { role: "system", content: `${SYSTEM_PROMPT}\n\n${FIELD_MAPPING_PROMPT}` },
            { role: "user", content: userMessage },
          ],
        });

        const raw = JSON.parse(completion.choices[0].message.content ?? "{}") as Record<
          string,
          unknown
        >;

        // Normalize common alias keys defensively to avoid bad mapping.
        const productName = pickFirstString(raw, ["productName", "title", "name", "product_title"]);
        const brand = pickFirstString(raw, ["brand", "manufacturer"]);
        const sellerName = pickFirstString(raw, ["sellerName", "seller", "soldBy", "merchant"]);
        const category = pickFirstString(raw, ["category", "department", "categoryName"]);
        const description = pickFirstString(raw, ["description", "productDescription", "about"]);
        const bulletsRaw = pickFirstArray(raw, ["bulletPoints", "features", "bullets", "keyFeatures"]);
        const imagesRaw = pickFirstArray(raw, ["imageUrls", "images", "image_urls", "gallery"]);
        const priceValue = raw.price ?? raw.currentPrice ?? raw.salePrice;
        const ratingValue = raw.rating ?? raw.stars ?? raw.reviewRating;
        const extractedFromHtml = htmlRaw ? extractAmazonImageUrlsFromHtml(htmlRaw) : [];
        const mappedImages = normalizeImageUrls(imagesRaw) ?? [];
        const imageUrls = Array.from(new Set([...mappedImages, ...extractedFromHtml])).slice(0, 30);

        const data: ParsedPdpData = {
          productName,
          brand,
          sellerName,
          category,
          price: toNumber(priceValue),
          rating: toNumber(ratingValue),
          bulletPoints: normalizeBulletPoints(bulletsRaw),
          description,
          imageUrls: imageUrls.length ? imageUrls : undefined,
        };

        return { ok: true, asin, source, data };
      } catch (error) {
        lastError = error;

          // Use the SDK's structured error codes — much more reliable than parsing message text.
          // insufficient_quota  → billing/account limit, no point retrying
          // rate_limit_exceeded → temporary TPM/RPM limit, retry with backoff
          if (error instanceof APIError) {
            const code = error.code ?? "";
            if (code === "insufficient_quota") {
              return {
                ok: false,
                asin,
                source: "OpenAI",
                data: {},
                error: error.message,
                quotaExceeded: true,
              };
            }
            if (code === "rate_limit_exceeded" && attempt < MAX_RETRIES - 1) {
              // Exponential backoff: 1s, 2s, 4s
              await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
              continue;
            }
          }

        // Non-retryable error or retries exhausted
        break;
      }
    }

    return {
      ok: false,
      asin,
      source: "OpenAI",
      data: {},
      error: lastError instanceof Error ? lastError.message : "OpenAI extraction failed",
    };
  }
}
