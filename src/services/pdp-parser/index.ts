import { MockPdpParserProvider } from "@/services/pdp-parser/providers/mock-pdp-provider";
import { RainforestPdpParserProvider } from "@/services/pdp-parser/providers/rainforest-provider";
import { HtmlPdpParserProvider } from "@/services/pdp-parser/providers/html-pdp-provider";
import type { PdpParserProvider } from "@/services/pdp-parser/types";

/**
 * Priority order:
 *  1. Rainforest API  (most complete structured data, requires RAINFOREST_API_KEY)
 *  2. HTML            (deterministic extraction from live Amazon page, no API key needed)
 *  3. Mock            (deterministic demo catalog — fallback of last resort)
 */
export function getPdpParserProvider(): PdpParserProvider {
  if (process.env.RAINFOREST_API_KEY) {
    return new RainforestPdpParserProvider();
  }
  return new HtmlPdpParserProvider();
}
