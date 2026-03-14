import { PdpParserProvider, PdpParseResult, ParsedPdpData } from "@/services/pdp-parser/types";

/**
 * RainforestAPI provider scaffold.
 * Docs: https://rainforestapi.com/docs/product-data-api/parameters/product
 *
 * Set the following env vars to activate:
 *   RAINFOREST_API_KEY=your_key
 *   RAINFOREST_API_BASE_URL=https://api.rainforestapi.com  (optional, defaults shown)
 */
export class RainforestPdpParserProvider implements PdpParserProvider {
  name = "RainforestPdpParserProvider";

  async parse(asin: string, amazonDomain: string): Promise<PdpParseResult> {
    const apiKey = process.env.RAINFOREST_API_KEY;
    const baseUrl = process.env.RAINFOREST_API_BASE_URL ?? "https://api.rainforestapi.com";

    if (!apiKey) {
      return {
        ok: false,
        asin,
        source: "RainforestAPI (not configured)",
        data: {},
        error: "RAINFOREST_API_KEY is not set. Falling back to mock provider.",
      };
    }

    const params = new URLSearchParams({
      api_key: apiKey,
      type: "product",
      asin,
      amazon_domain: amazonDomain,
    });

    const response = await fetch(`${baseUrl}/request?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return {
        ok: false,
        asin,
        source: "RainforestAPI",
        data: {},
        error: `API responded with status ${response.status}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await response.json();
    const product = json?.product;

    if (!product) {
      return {
        ok: false,
        asin,
        source: "RainforestAPI",
        data: {},
        error: "No product data returned from API",
      };
    }

    const data: ParsedPdpData = {
      productName: product.title ?? undefined,
      brand: product.brand ?? undefined,
      sellerName: product.sold_by?.name ?? product.brand ?? undefined,
      category: product.categories?.[0]?.name ?? undefined,
      price: product.buybox_winner?.price?.value ?? undefined,
      rating: product.rating ?? undefined,
      bulletPoints: Array.isArray(product.feature_bullets)
        ? product.feature_bullets.map((b: string) => b.replace(/^\s*-\s*/, ""))
        : undefined,
      description: product.description ?? product.a_plus_content?.body_text ?? undefined,
      imageUrls: Array.isArray(product.images)
        ? product.images.map((img: { link: string }) => img.link).filter(Boolean)
        : undefined,
    };

    return {
      ok: true,
      asin,
      source: "RainforestAPI",
      data,
    };
  }
}
