import OpenAI from "openai";
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
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
        });

        const raw = JSON.parse(completion.choices[0].message.content ?? "{}");

        // Coerce price/rating to numbers if GPT returned strings
        const data: ParsedPdpData = {
          productName: raw.productName ?? undefined,
          brand: raw.brand ?? undefined,
          sellerName: raw.sellerName ?? undefined,
          category: raw.category ?? undefined,
          price: raw.price !== undefined ? Number(raw.price) || undefined : undefined,
          rating: raw.rating !== undefined ? Number(raw.rating) || undefined : undefined,
          bulletPoints: Array.isArray(raw.bulletPoints) ? raw.bulletPoints : undefined,
          description: raw.description ?? undefined,
          imageUrls: Array.isArray(raw.imageUrls) ? raw.imageUrls.filter(Boolean) : undefined,
        };

        return { ok: true, asin, source, data };
      } catch (error) {
        lastError = error;

        const msg = error instanceof Error ? error.message : "";
        const isRateLimit = msg.includes("429") || msg.toLowerCase().includes("rate limit");
        // Billing/account-level quota — no point retrying
        const isBillingQuota =
          msg.toLowerCase().includes("quota") || msg.toLowerCase().includes("billing");

        if (isBillingQuota) {
          return {
            ok: false,
            asin,
            source: "OpenAI",
            data: {},
            error: msg || "OpenAI quota exceeded",
            quotaExceeded: true,
          };
        }

        if (isRateLimit && attempt < MAX_RETRIES - 1) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
          continue;
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
