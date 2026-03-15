import type { PdpParserProvider, PdpParseResult, ParsedPdpData } from "@/services/pdp-parser/types";

// ─── Utilities ────────────────────────────────────────────────────────────────

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
  const regex = new RegExp(`id=["']${id}["'][^>]*>([\\s\\S]{0,4000}?)<\\/`, "i");
  const match = html.match(regex);
  if (!match?.[1]) return undefined;
  const text = stripTags(match[1]);
  return text || undefined;
}

function extractPriceFromHtml(html: string): number | undefined {
  const idCandidates = [
    "priceblock_ourprice",
    "priceblock_dealprice",
    "price_inside_buybox",
    "corePrice_desktop",
    "corePriceDisplay_desktop",
  ];
  for (const id of idCandidates) {
    const text = extractByIdText(html, id);
    if (!text) continue;
    const raw = text.match(/\d[\d\s]*[.,]\d{2}/)?.[0];
    if (!raw) continue;
    const price = Number(raw.replace(/\s/g, "").replace(",", "."));
    if (Number.isFinite(price) && price > 0) return price;
  }
  // JSON-embedded price amount
  const fallbacks = [
    html.match(/"priceAmount"\s*:\s*"?(\d+[\.,]\d{2})"?/i)?.[1],
    html.match(/"price"\s*:\s*"?(\d+[\.,]\d{2})"?/i)?.[1],
  ];
  for (const raw of fallbacks) {
    if (!raw) continue;
    const price = Number(raw.replace(",", "."));
    if (Number.isFinite(price) && price > 0) return price;
  }
  return undefined;
}

function extractRatingFromHtml(html: string): number | undefined {
  const m =
    html.match(/(\d(?:[\.,]\d)?)\s*out of\s*5\s*stars/i) ??
    html.match(/"ratingValue"\s*:\s*"?(\d(?:[\.,]\d)?)"?/i) ??
    html.match(/"rating"\s*:\s*"?(\d(?:[\.,]\d)?)"?/i);
  if (!m?.[1]) return undefined;
  const rating = Number(m[1].replace(",", "."));
  return Number.isFinite(rating) ? rating : undefined;
}

function extractBulletPointsFromHtml(html: string): string[] | undefined {
  const block = html.match(
    /id=["'](?:feature-bullets|featurebullets_feature_div)["'][\s\S]{0,10000}?<\/ul>/i,
  )?.[0];
  if (!block) return undefined;
  const bullets = Array.from(block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((m) => stripTags(m[1] ?? ""))
    .map((t) => t.replace(/^[\-•–*\s]+/, "").trim())
    .filter((t) => t.length > 4 && !/customer reviews|ask a question/i.test(t));
  return bullets.length ? Array.from(new Set(bullets)).slice(0, 10) : undefined;
}

function extractBrandFromHtml(html: string): string | undefined {
  // Byline link (Visit the ... Store)
  const byline = extractByIdText(html, "bylineInfo");
  if (byline) {
    const cleaned = byline.replace(/^Visit the\s+/i, "").replace(/\s+Store$/i, "").trim();
    if (cleaned.length > 1) return cleaned;
  }
  // Brand row in the tech/product details table
  const brandRow = html.match(
    /<tr[^>]*>[\s\S]*?Brand[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i,
  )?.[1];
  if (brandRow) {
    const text = stripTags(brandRow).trim();
    if (text.length > 1) return text;
  }
  return undefined;
}

function extractCategoryFromHtml(html: string): string | undefined {
  // Breadcrumb links
  const crumbs = Array.from(
    html.matchAll(
      /class=["'][^"']*a-link-normal[^"']*a-color-tertiary[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
    ),
  )
    .map((m) => stripTags(m[1] ?? ""))
    .filter(Boolean);
  if (crumbs[0]) return crumbs[0];

  // Category in the details table
  const catRow = html.match(
    /<tr[^>]*>[\s\S]*?Best Sellers Rank[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i,
  )?.[1];
  if (catRow) {
    const text = stripTags(catRow).trim();
    if (text.length > 1) return text;
  }
  return undefined;
}

function extractDescriptionFromHtml(html: string): string | undefined {
  const fromDescription = extractByIdText(html, "productDescription");
  if (fromDescription && fromDescription.length > 20) return fromDescription;
  const fromAplus =
    extractByIdText(html, "aplus_feature_div") ?? extractByIdText(html, "aplus");
  return fromAplus || undefined;
}

function canonicalizeAmazonImageUrl(url: string): string {
  let out = url.trim().replace(/\\\//g, "/").replace(/["',\s]+$/g, "");
  if (!out.startsWith("https://")) return out;
  // Remove query/hash noise that often breaks direct image preview links
  out = out.split("?")[0].split("#")[0];
  // Append .jpg if no extension on Amazon media URLs
  if (
    /media-amazon\.com|images-amazon\.com/i.test(out) &&
    !/\.(jpg|jpeg|png|webp)$/i.test(out)
  ) {
    out = `${out}.jpg`;
  }
  return out;
}

function extractCarouselBlocks(html: string): string[] {
  const blocks: string[] = [];

  // IMPORTANT: we intentionally keep only the PDP image carousel sections.
  // This excludes images from recommendations, ads, A+ content, and other page areas.
  const patterns = [
    /id=["']altImages["'][\s\S]{0,120000}?<\/ul>/i,
    /id=["']imageBlock["'][\s\S]{0,160000}?<\/div>/i,
    /id=["']imageBlockThumbs["'][\s\S]{0,120000}?<\/div>/i,
    /id=["']ivImages["'][\s\S]{0,120000}?<\/ul>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[0]) blocks.push(match[0]);
  }

  return blocks;
}

function extractImageUrlsFromHtml(html: string): string[] {
  const found = new Set<string>();
  const carouselBlocks = extractCarouselBlocks(html);

  // Only parse URLs from carousel blocks. If not found, return no images instead of broad scraping.
  if (!carouselBlocks.length) return [];

  const carouselHtml = carouselBlocks.join("\n\n");

  // Direct image URLs in HTML attributes
  const attrPattern = /https:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:[^\s"'<>]*)/gi;
  for (const match of carouselHtml.matchAll(attrPattern)) {
    const raw = (match[0] ?? "").trim();
    if (!/images[-.]amazon\.com|media-amazon\.com/i.test(raw)) continue;
    if (/sprite|icon|logo|spacer|transparent|blank/i.test(raw)) continue;
    const candidate = canonicalizeAmazonImageUrl(raw);
    if (candidate) found.add(candidate);
    // Also add variant without dimension suffix (e.g. ._SX300_)
    const stripped = candidate.replace(/\._[A-Z]{2}\d+_\./g, ".");
    if (stripped !== candidate) found.add(stripped);
  }

  // JSON-embedded image objects (hiRes / large / mainUrl / thumb / variant)
  const jsonKeyPattern = new RegExp(
    '"(?:hiRes|large|mainUrl|thumb|variant)"\\s*:\\s*"(https:\\\\/\\\\/[^\\"]+)"',
    "gi",
  );
  for (const match of carouselHtml.matchAll(jsonKeyPattern)) {
    const raw = (match[1] ?? "").replace(/\\\//g, "/");
    if (!/images[-.]amazon\.com|media-amazon\.com/i.test(raw)) continue;
    if (/sprite|icon|logo|spacer/i.test(raw)) continue;
    const candidate = canonicalizeAmazonImageUrl(raw);
    if (candidate) found.add(candidate);
    const stripped = candidate.replace(/\._[A-Z]{2}\d+_\./g, ".");
    if (stripped !== candidate) found.add(stripped);
  }

  // data-a-dynamic-image JSON map  {"url": count, ...}
  const dynPattern = /data-a-dynamic-image=["']\{([^"']+)\}["']/gi;
  for (const match of carouselHtml.matchAll(dynPattern)) {
    const block = `{${match[1]}}`.replace(/&quot;/g, '"');
    try {
      const obj = JSON.parse(block) as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (!/images[-.]amazon\.com|media-amazon\.com/i.test(key)) continue;
        if (/sprite|icon|logo|spacer/i.test(key)) continue;
        const candidate = canonicalizeAmazonImageUrl(key);
        if (candidate) found.add(candidate);
      }
    } catch {
      // ignore malformed JSON
    }
  }

  return Array.from(found).slice(0, 30);
}

function extractFromHtml(html: string): ParsedPdpData {
  const imageUrls = extractImageUrlsFromHtml(html);
  return {
    productName: extractByIdText(html, "productTitle"),
    brand: extractBrandFromHtml(html),
    category: extractCategoryFromHtml(html),
    price: extractPriceFromHtml(html),
    rating: extractRatingFromHtml(html),
    bulletPoints: extractBulletPointsFromHtml(html),
    description: extractDescriptionFromHtml(html),
    imageUrls: imageUrls.length ? imageUrls : undefined,
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class HtmlPdpParserProvider implements PdpParserProvider {
  name = "HtmlPdpParserProvider";

  async parse(asin: string, amazonDomain: string): Promise<PdpParseResult> {
    const productUrl = `https://www.${amazonDomain}/dp/${asin}`;

    try {
      const resp = await fetch(productUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });

      if (!resp.ok) {
        return {
          ok: false,
          asin,
          source: "HTML",
          data: {},
          error: `HTTP ${resp.status} when fetching ${productUrl}`,
        };
      }

      const html = await resp.text();

      // Detect CAPTCHA / bot-check page
      const isCaptcha =
        html.includes("Type the characters you see in this image") ||
        html.includes("api.cer.amazon.com") ||
        html.includes("robot check") ||
        html.includes("Enter the characters you see below");

      if (isCaptcha) {
        return {
          ok: false,
          asin,
          source: "HTML",
          data: {},
          error: "Amazon returned a CAPTCHA page. Try again later.",
        };
      }

      const data = extractFromHtml(html);

      return {
        ok: true,
        asin,
        source: "HTML (live fetch)",
        data,
      };
    } catch (err) {
      return {
        ok: false,
        asin,
        source: "HTML",
        data: {},
        error: err instanceof Error ? err.message : "HTML fetch failed",
      };
    }
  }
}
