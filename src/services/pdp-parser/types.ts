import { ProductInput } from "@/types/pdp";

/** Subset of ProductInput that can be auto-filled from an external source. */
export type ParsedPdpData = Partial<
  Pick<
    ProductInput,
    | "productName"
    | "brand"
    | "sellerName"
    | "category"
    | "price"
    | "rating"
    | "bulletPoints"
    | "description"
    | "imageUrls"
    | "optionalWebsiteOrCompany"
  >
>;

export interface PdpParseResult {
  ok: boolean;
  asin: string | null;
  source: string;
  data: ParsedPdpData;
  error?: string;
}

export interface PdpParserProvider {
  name: string;
  parse(asin: string, amazonDomain: string): Promise<PdpParseResult>;
}
