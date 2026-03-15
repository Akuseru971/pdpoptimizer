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

Your job is to map all product information visible on an Amazon product detail page for a single ASIN into a normalized JSON object.

You must follow these rules strictly:
1. Extract only information that is explicitly present in the provided inputs.
2. Never invent, infer, or guess missing values.
3. If a value is ambiguous, conflicting, or not visible, return null.
4. Ignore recommendations, sponsored blocks, and unrelated offers.
5. Distinguish carefully between brand, seller, manufacturer, ship_from, sold_by.
6. Normalize values where possible: numeric prices/ratings/review_count.
7. Preserve evidence for important fields.
8. If multiple candidate values exist, choose the one linked to the main PDP.
9. Extract variation selectors separately when present.
10. Output JSON only; no markdown; no extra explanations.
11. Absent fields must be null/[]/{} depending on schema.
12. Confidence must reflect certainty from provided page content only.

Extraction priority:
1. Main title area
2. Buy box / offer area
3. Bullet points
4. Product details / technical details / attributes tables
5. Variation selectors
6. A+ / brand content
7. OCR-visible screenshot text
8. URL / ASIN metadata`;

const USER_PROMPT_SCHEMA = `Return only valid JSON following this exact structure:
{
  "asin": { "value": "string or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
  "url": "string or null",
  "marketplace": "string or null",
  "product_title": { "value": "string or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
  "brand": { "value": "string or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
  "seller": { "value": "string or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
  "sold_by": { "value": "string or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
  "price": {
    "current_price": { "value": "number or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
    "original_price": { "value": "number or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
    "currency": "string or null",
    "discount_text": "string or null"
  },
  "rating": { "value": "number or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
  "review_count": { "value": "integer or null", "confidence": "high|medium|low", "evidence_text": "string", "evidence_source": "title_area|buy_box|bullets|details_table|technical_details|variation_selector|a_plus|image_ocr|url|metadata|not_found" },
  "bullet_points": [{ "text": "string" }],
  "description": "string or null",
  "image_count": "integer or null",
  "image_urls": ["string"],
  "category_path": ["string"]
}`;

function unwrapValue(node: unknown): unknown {
  if (node && typeof node === "object" && "value" in (node as Record<string, unknown>)) {
    return (node as Record<string, unknown>).value;
  }
  return node;
}

function asString(node: unknown): string | undefined {
  const value = unwrapValue(node);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(node: unknown): number | undefined {
  const value = unwrapValue(node);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.,]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBulletList(node: unknown): string[] | undefined {
  if (!Array.isArray(node)) return undefined;
  const list = node
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const text = (item as Record<string, unknown>).text;
        return typeof text === "string" ? text.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
  return list.length ? Array.from(new Set(list)).slice(0, 10) : undefined;
}

function mapStructuredResponseToParsedPdpData(raw: Record<string, unknown>): ParsedPdpData {
  const categoryPath = Array.isArray(raw.category_path)
    ? raw.category_path.filter((x): x is string => typeof x === "string" && !!x.trim())
    : [];

  const imageUrlsFromStructured = Array.isArray(raw.image_urls) ? normalizeImageUrls(raw.image_urls) : undefined;
  const imageUrlsFromLegacy = Array.isArray(raw.imageUrls) ? normalizeImageUrls(raw.imageUrls) : undefined;

  return {
    productName: asString(raw.product_title) ?? asString(raw.productName),
    brand: asString(raw.brand),
    sellerName: asString(raw.sold_by) ?? asString(raw.seller) ?? asString(raw.sellerName),
    category: categoryPath[0] ?? asString(raw.category),
    price: asNumber((raw.price as Record<string, unknown> | undefined)?.current_price) ?? asNumber(raw.price),
    rating: asNumber(raw.rating),
    bulletPoints: asBulletList(raw.bullet_points) ?? asBulletList(raw.bulletPoints),
    description: asString(raw.description),
    imageUrls: imageUrlsFromStructured ?? imageUrlsFromLegacy,
  };
}

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
    const pageText = htmlContent ? stripTags(htmlContent).slice(0, 18000) : "";
    const userMessage = [
      "Map this Amazon PDP into the required JSON structure.",
      `ASIN: ${asin}`,
      `URL: ${productUrl}`,
      `Marketplace: ${amazonDomain}`,
      "Page language: en",
      "Visible text extracted from page:",
      pageText || "",
      "Optional OCR text extracted from screenshots:",
      "",
      "Optional page metadata:",
      JSON.stringify({ source: source, marketplace: amazonDomain }),
      USER_PROMPT_SCHEMA,
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
        const dataFromModel = mapStructuredResponseToParsedPdpData(raw);
        const imagesRaw = dataFromModel.imageUrls;
        const extractedFromHtml = htmlRaw ? extractAmazonImageUrlsFromHtml(htmlRaw) : [];
        const mappedImages = normalizeImageUrls(imagesRaw) ?? [];
        const imageUrls = Array.from(new Set([...mappedImages, ...extractedFromHtml])).slice(0, 30);

        // Keep the original field mapping behavior that was previously stable.
        const dataFromLlm: ParsedPdpData = {
          ...dataFromModel,
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
