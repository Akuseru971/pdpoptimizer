import { NextResponse } from "next/server";
import { extractAsin, amazonDomainFromUrl, isAmazonUrl } from "@/lib/asin";
import { getPdpParserProvider } from "@/services/pdp-parser";
import { MockPdpParserProvider } from "@/services/pdp-parser/providers/mock-pdp-provider";

export async function POST(req: Request) {
  try {
    const { url } = (await req.json()) as { url?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ ok: false, error: "Missing or invalid URL" }, { status: 400 });
    }

    if (!isAmazonUrl(url)) {
      return NextResponse.json(
        { ok: false, error: "URL does not appear to be an Amazon product page." },
        { status: 422 },
      );
    }

    const asin = extractAsin(url);

    if (!asin) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Could not extract an ASIN from the URL. Make sure it contains /dp/ASIN or /gp/product/ASIN.",
        },
        { status: 422 },
      );
    }

    const domain = amazonDomainFromUrl(url);
    const provider = getPdpParserProvider();
    let result = await provider.parse(asin, domain);

    // ── Quota / billing fallback ──────────────────────────────────────────────
    // If the primary provider hit a quota limit, cascade to the mock so the user
    // still gets a usable response instead of a blank error screen.
    if (!result.ok && result.quotaExceeded && !(provider instanceof MockPdpParserProvider)) {
      const mock = new MockPdpParserProvider();
      result = await mock.parse(asin, domain);
      result = {
        ...result,
        warning:
          "OpenAI quota exceeded — demo data shown. Add credits at platform.openai.com or set RAINFOREST_API_KEY.",
      };
    }

    return NextResponse.json({ ...result, provider: provider.name });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Internal error during PDP parsing",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
