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

const SYSTEM_PROMPT = `You are a strict Amazon PDP extraction engine.

Objective:
- Extract product fields from Amazon PDP content with maximum accuracy.
- If live HTML is provided, treat it as source of truth.
- Use prior knowledge only when HTML is not available.

Return format:
- Return ONLY one JSON object.
- Use ONLY these exact keys (no aliases, no extra keys):
  productName, brand, sellerName, category, price, rating, bulletPoints, description, imageUrls
- Omit unknown fields. Never guess.

Field mapping rules (critical):
- productName: Full listing title only (from product title area). Never put brand-only text here.
- brand: Brand/manufacturer only. Strip wrappers like "Visit the X Store".
- sellerName: Merchant sold-by name. If not visible, you may reuse brand.
- category: Top-level category/department (short label).
- price: Current displayed product price, numeric decimal only (no currency symbol).
- rating: Average star rating out of 5, numeric only.
- bulletPoints: Main feature bullets only; plain strings; no duplicates; no leading bullets.
- description: Long-form product description/A+ body text summary, not a duplicate of title.
- imageUrls: Product gallery image URLs only (no logos/icons/sprites/ads), absolute https URLs.

Quality checks before output:
- Ensure price and rating are numbers, not strings.
- Ensure bulletPoints is an array of strings.
- Ensure imageUrls is an array of URLs.
- If a value is low confidence or ambiguous, omit it.`;

function normalizeImageUrls(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value
    .map((item) => (typeof item === "string" ? canonicalizeAmazonImageUrl(item) : ""))
    .filter((url) => /^https:\/\//i.test(url))
    .filter((url) => !/sprite|icon|logo|spacer/i.test(url));
  return urls.length ? Array.from(new Set(urls)).slice(0, 20) : undefined;
}

function canonicalizeAmazonImageUrl(url: string): string {
  let out = url.trim().replace(/\\\//g, "/").replace(/["',\s]+$/g, "");
  if (!out.startsWith("https://")) return out;
  // Remove query/hash noise that often breaks direct image preview links
  out = out.split("?")[0].split("#")[0];
  // If extension is missing on Amazon media URLs, append jpg fallback
  if (/media-amazon\.com|images-amazon\.com/i.test(out) && !/\.(jpg|jpeg|png|webp)$/i.test(out)) {
    out = `${out}.jpg`;
  }
  return out;
}

function extractAmazonImageUrlsFromHtml(html: string): string[] {
  const found = new Set<string>();

  // Direct image URLs in HTML attributes.
  const attrPattern = /https:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:[^\s"'<>]*)/gi;
  for (const match of html.matchAll(attrPattern)) {
    const candidate = canonicalizeAmazonImageUrl((match[0] ?? "").trim());
    if (!candidate) continue;
    if (!/images[-.]amazon\.com|media-amazon\.com/i.test(candidate)) continue;
    if (/sprite|icon|logo|spacer/i.test(candidate)) continue;
    found.add(candidate);

    // Add an alternate normalized variant only as backup.
    const stripped = candidate.replace(/\._[^.]+\./, ".");
    if (stripped !== candidate) found.add(stripped);
  }

  // JSON-embedded image objects (hiRes/large/mainUrl keys are common on Amazon PDP).
  const jsonKeyPattern = new RegExp(
    '"(?:hiRes|large|mainUrl|thumb|variant)"\\s*:\\s*"(https:\\\\/\\\\/[^\\"]+)"',
    "gi",
  );
  for (const match of html.matchAll(jsonKeyPattern)) {
    const candidate = canonicalizeAmazonImageUrl(match[1] ?? "");
    if (!candidate) continue;
    if (!/images[-.]amazon\.com|media-amazon\.com/i.test(candidate)) continue;
    if (/sprite|icon|logo|spacer/i.test(candidate)) continue;
    found.add(candidate);

    const stripped = candidate.replace(/\._[^.]+\./, ".");
    if (stripped !== candidate) found.add(stripped);
  }

  return Array.from(found).slice(0, 30);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function extractByIdText(html: string, id: string): string | undefined {
  const regex = new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]{0,3000}?)<\\/`, "i");
  const match = html.match(regex);
  if (!match?.[1]) return undefined;
  const text = stripTags(match[1]);
  return text || undefined;
}

function extractPriceFromHtml(html: string): number | undefined {
  const idCandidates = ["priceblock_ourprice", "priceblock_dealprice", "price_inside_buybox", "corePrice_desktop"];
  for (const id of idCandidates) {
    const text = extractByIdText(html, id);
    if (!text) continue;
    const price = Number((text.match(/\d+[\.,]\d{2}/)?.[0] ?? "").replace(",", "."));
    if (Number.isFinite(price)) return price;
  }
  const fallback = html.match(/"priceAmount"\s*:\s*"?(\d+[\.,]\d{2})"?/i)?.[1];
  if (!fallback) return undefined;
  const price = Number(fallback.replace(",", "."));
  return Number.isFinite(price) ? price : undefined;
}

function extractRatingFromHtml(html: string): number | undefined {
  const m = html.match(/(\d(?:[\.,]\d)?)\s*out of\s*5\s*stars/i) ?? html.match(/"rating"\s*:\s*"?(\d(?:[\.,]\d)?)"?/i);
  if (!m?.[1]) return undefined;
  const rating = Number(m[1].replace(",", "."));
  return Number.isFinite(rating) ? rating : undefined;
}

function extractBulletPointsFromHtml(html: string): string[] | undefined {
  const block = html.match(/id=["'](?:feature-bullets|featurebullets_feature_div)["'][\s\S]{0,8000}?<\/ul>/i)?.[0];
  if (!block) return undefined;
  const bullets = Array.from(block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((m) => stripTags(m[1] ?? ""))
    .map((t) => t.replace(/^[\-•–\*\s]+/, "").trim())
    .filter((t) => t && !/customer reviews|ask a question/i.test(t));
  return bullets.length ? Array.from(new Set(bullets)).slice(0, 10) : undefined;
}

function extractBrandFromHtml(html: string): string | undefined {
  const byline = extractByIdText(html, "bylineInfo");
  if (!byline) return undefined;
  return byline.replace(/^Visit the\s+/i, "").replace(/\s+Store$/i, "").trim() || undefined;
}

function extractCategoryFromHtml(html: string): string | undefined {
  const crumbs = Array.from(html.matchAll(/class=["'][^"']*a-link-normal[^"']*a-color-tertiary[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((m) => stripTags(m[1] ?? ""))
    .filter(Boolean);
  return crumbs[0] || undefined;
}

function extractDescriptionFromHtml(html: string): string | undefined {
  const fromDescription = extractByIdText(html, "productDescription");
  if (fromDescription) return fromDescription;
  const fromAplus = extractByIdText(html, "aplus_feature_div") ?? extractByIdText(html, "aplus");
  return fromAplus || undefined;
}

function extractPdpFallbackFromHtml(html: string): ParsedPdpData {
  return {
    productName: extractByIdText(html, "productTitle"),
    brand: extractBrandFromHtml(html),
    category: extractCategoryFromHtml(html),
    price: extractPriceFromHtml(html),
    rating: extractRatingFromHtml(html),
    bulletPoints: extractBulletPointsFromHtml(html),
    description: extractDescriptionFromHtml(html),
    imageUrls: extractAmazonImageUrlsFromHtml(html),
  };
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
      ? [
          `ASIN: ${asin}`,
          `Amazon domain: ${amazonDomain}`,
          "Mode: LIVE_HTML",
          "Instruction: extract fields from this HTML only. If not explicitly present, omit.",
          "HTML:",
          htmlContent.slice(0, 14_000),
        ].join("\n\n")
      : [
          `ASIN: ${asin}`,
          `Amazon domain: ${amazonDomain}`,
          `Product URL: ${productUrl}`,
          "Mode: KNOWLEDGE_FALLBACK",
          "Instruction: use best-effort knowledge; omit uncertain fields.",
        ].join("\n\n");

    const MAX_RETRIES = 3;
    let lastError: unknown;
    const htmlFallback = htmlRaw ? extractPdpFallbackFromHtml(htmlRaw) : {};

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const completion = await this.client.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        });

        const raw = JSON.parse(completion.choices[0].message.content ?? "{}") as Record<string, unknown>;
        const imagesRaw = Array.isArray(raw.imageUrls) ? raw.imageUrls : undefined;
        const extractedFromHtml = htmlRaw ? extractAmazonImageUrlsFromHtml(htmlRaw) : [];
        const mappedImages = normalizeImageUrls(imagesRaw) ?? [];
        const imageUrls = Array.from(new Set([...mappedImages, ...extractedFromHtml])).slice(0, 30);

        // Keep the original field mapping behavior that was previously stable.
        const dataFromLlm: ParsedPdpData = {
          productName: typeof raw.productName === "string" ? raw.productName : undefined,
          brand: typeof raw.brand === "string" ? raw.brand : undefined,
          sellerName: typeof raw.sellerName === "string" ? raw.sellerName : undefined,
          category: typeof raw.category === "string" ? raw.category : undefined,
          price: raw.price !== undefined ? Number(raw.price) || undefined : undefined,
          rating: raw.rating !== undefined ? Number(raw.rating) || undefined : undefined,
          bulletPoints: Array.isArray(raw.bulletPoints) ? (raw.bulletPoints as string[]) : undefined,
          description: typeof raw.description === "string" ? raw.description : undefined,
          imageUrls: imageUrls.length ? imageUrls : undefined,
        };

        const data: ParsedPdpData = {
          productName: dataFromLlm.productName ?? htmlFallback.productName,
          brand: dataFromLlm.brand ?? htmlFallback.brand,
          sellerName: dataFromLlm.sellerName ?? dataFromLlm.brand ?? htmlFallback.brand,
          category: dataFromLlm.category ?? htmlFallback.category,
          price: dataFromLlm.price ?? htmlFallback.price,
          rating: dataFromLlm.rating ?? htmlFallback.rating,
          bulletPoints: dataFromLlm.bulletPoints ?? htmlFallback.bulletPoints,
          description: dataFromLlm.description ?? htmlFallback.description,
          imageUrls: dataFromLlm.imageUrls ?? htmlFallback.imageUrls,
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
