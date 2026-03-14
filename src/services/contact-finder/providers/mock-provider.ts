import { ContactResult, ProductInput } from "@/types/pdp";
import { ContactFinderProvider } from "@/services/contact-finder/types";

type Seed = {
  entityName: string;
  website: string;
  email: string | null;
  entityType: ContactResult["entityType"];
  confidence: ContactResult["confidence"];
  confidenceScore: number;
  sourceLabel: string;
  alternativePath: string;
  explanation: string;
};

const MOCK_SEEDS: Record<string, Seed> = {
  northtrail: {
    entityName: "NorthTrail Gear LLC",
    website: "https://northtrailgear.com",
    email: "hello@northtrailgear.com",
    entityType: "brand",
    confidence: "high",
    confidenceScore: 88,
    sourceLabel: "Mock Directory - Brand Match",
    alternativePath: "Use website contact form and LinkedIn company page.",
    explanation: "Brand name and website align strongly with product context.",
  },
  aurakitchen: {
    entityName: "Aura Kitchen Co.",
    website: "https://aurakitchen.co",
    email: null,
    entityType: "company",
    confidence: "medium",
    confidenceScore: 61,
    sourceLabel: "Mock Directory - Company Mention",
    alternativePath: "No public email found. Try About page and seller support profile.",
    explanation: "Entity appears in business records, but direct email is not publicly listed.",
  },
};

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

export class MockContactFinderProvider implements ContactFinderProvider {
  name = "MockContactFinderProvider";

  async lookup(input: ProductInput): Promise<ContactResult> {
    const key = normalize(input.brand || input.optionalWebsiteOrCompany || input.sellerName);
    const matched = Object.entries(MOCK_SEEDS).find(([seedKey]) => key.includes(seedKey))?.[1];

    if (!matched) {
      return {
        detectedEntityName: input.brand || input.sellerName || "Unknown business entity",
        entityType: input.brand ? "brand" : "seller",
        officialWebsite: input.optionalWebsiteOrCompany
          ? `https://${input.optionalWebsiteOrCompany.replace(/^https?:\/\//, "")}`
          : null,
        publicEmail: null,
        alternativeContactPath:
          "No public email found. Check official website contact page, seller storefront, or business registry.",
        sourceLabel: "Mock Directory - No Match",
        confidence: "low",
        confidenceScore: 32,
        explanation:
          "No deterministic match found from mock records. A real search API provider may return additional public contact paths.",
      };
    }

    return {
      detectedEntityName: matched.entityName,
      entityType: matched.entityType,
      officialWebsite: matched.website,
      publicEmail: matched.email,
      alternativeContactPath: matched.alternativePath,
      sourceLabel: matched.sourceLabel,
      confidence: matched.confidence,
      confidenceScore: matched.confidenceScore,
      explanation: matched.explanation,
    };
  }
}
