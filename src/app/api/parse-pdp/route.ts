import { NextResponse } from "next/server";
import { extractAsin, amazonDomainFromUrl, isAmazonUrl } from "@/lib/asin";
import { getPdpParserProvider } from "@/services/pdp-parser";

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
    const result = await provider.parse(asin, domain);

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
