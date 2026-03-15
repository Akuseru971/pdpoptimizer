import { RainforestPdpParserProvider } from "@/services/pdp-parser/providers/rainforest-provider";
import { HtmlPdpParserProvider } from "@/services/pdp-parser/providers/html-pdp-provider";
import { VisionPdpParserProvider } from "@/services/pdp-parser/providers/vision-pdp-provider";
import type { PdpParserProvider } from "@/services/pdp-parser/types";

/**
 * Priority order:
 *  1. Rainforest API  (most complete structured data, requires RAINFOREST_API_KEY)
 *  2. Vision          (screenshots + OpenAI extraction, requires OPENAI_API_KEY + ENABLE_VISION_PARSER=1)
 *  3. HTML            (deterministic extraction from live Amazon page)
 *  4. Mock            (deterministic demo catalog — fallback of last resort)
 */
export function getPdpParserProvider(): PdpParserProvider {
  if (process.env.RAINFOREST_API_KEY) {
    return new RainforestPdpParserProvider();
  }
  // Vision mode requires Playwright browser binaries in the runtime environment.
  // Keep it opt-in to avoid deployment/runtime failures on serverless targets.
  if (process.env.OPENAI_API_KEY && process.env.ENABLE_VISION_PARSER === "1") {
    return new VisionPdpParserProvider();
  }
  return new HtmlPdpParserProvider();
}
