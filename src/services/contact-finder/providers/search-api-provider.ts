import { ContactFinderProvider } from "@/services/contact-finder/types";
import { ContactResult, ProductInput } from "@/types/pdp";

export class SearchApiContactFinderProvider implements ContactFinderProvider {
  name = "SearchApiContactFinderProvider";

  async lookup(input: ProductInput): Promise<ContactResult> {
    const apiKey = process.env.SEARCH_API_KEY;
    const baseUrl = process.env.SEARCH_API_BASE_URL;

    if (!apiKey || !baseUrl) {
      return {
        detectedEntityName: input.brand || input.sellerName || "Unknown",
        entityType: input.brand ? "brand" : "seller",
        officialWebsite: input.optionalWebsiteOrCompany || null,
        publicEmail: null,
        alternativeContactPath:
          "Search API is not configured. Fallback to mock provider or manually verify business contact pages.",
        sourceLabel: "Search API Provider (Not Configured)",
        confidence: "low",
        confidenceScore: 20,
        explanation:
          "Missing SEARCH_API_KEY or SEARCH_API_BASE_URL. Provider is scaffolded for future integration only.",
      };
    }

    return {
      detectedEntityName: input.brand || input.sellerName || "Unknown",
      entityType: input.brand ? "brand" : "seller",
      officialWebsite: input.optionalWebsiteOrCompany || null,
      publicEmail: null,
      alternativeContactPath: "API configured but lookup implementation is intentionally deferred in MVP.",
      sourceLabel: "Search API Provider (Scaffold)",
      confidence: "low",
      confidenceScore: 25,
      explanation: "Real third-party integration is not implemented in this MVP by design.",
    };
  }
}
