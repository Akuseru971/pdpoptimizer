import { MockPdpParserProvider } from "@/services/pdp-parser/providers/mock-pdp-provider";
import { RainforestPdpParserProvider } from "@/services/pdp-parser/providers/rainforest-provider";
import type { PdpParserProvider } from "@/services/pdp-parser/types";

export function getPdpParserProvider(): PdpParserProvider {
  if (process.env.RAINFOREST_API_KEY) {
    return new RainforestPdpParserProvider();
  }
  return new MockPdpParserProvider();
}
