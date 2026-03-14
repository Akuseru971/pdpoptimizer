import { MockPdpParserProvider } from "@/services/pdp-parser/providers/mock-pdp-provider";
import { RainforestPdpParserProvider } from "@/services/pdp-parser/providers/rainforest-provider";
import { OpenAIPdpParserProvider } from "@/services/pdp-parser/providers/openai-pdp-provider";
import type { PdpParserProvider } from "@/services/pdp-parser/types";

/**
 * Priority order:
 *  1. Rainforest API  (most complete structured data, requires RAINFOREST_API_KEY)
 *  2. OpenAI          (live fetch + GPT-4o extraction, requires OPENAI_API_KEY)
 *  3. Mock            (deterministic demo catalog — no API key required)
 */
export function getPdpParserProvider(): PdpParserProvider {
  if (process.env.RAINFOREST_API_KEY) {
    return new RainforestPdpParserProvider();
  }
  if (process.env.OPENAI_API_KEY) {
    return new OpenAIPdpParserProvider();
  }
  return new MockPdpParserProvider();
}
