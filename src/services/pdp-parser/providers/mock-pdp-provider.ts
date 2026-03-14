import { PdpParserProvider, PdpParseResult } from "@/services/pdp-parser/types";

// Small seed dictionary keyed by ASIN prefix for deterministic mock responses.
const MOCK_CATALOG: Record<string, PdpParseResult["data"]> = {
  B0DEMO: {
    productName: "NorthTrail Vacuum Insulated Stainless Steel Water Bottle 32oz",
    brand: "NorthTrail",
    sellerName: "NorthTrail Direct",
    category: "Sports",
    price: 27.99,
    rating: 3.9,
    bulletPoints: [
      "32oz double-wall stainless steel construction",
      "Leak-proof cap with carrying loop",
      "Keeps cold up to 24 hours",
      "Powder-coated anti-slip finish",
      "BPA-free, dishwasher-safe lid",
    ],
    description:
      "A practical bottle built for workouts, commutes, and travel. Designed to maintain cold temperature while resisting dents and flavor transfer. Compatible with standard cup holders.",
    imageUrls: [
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1200&q=80",
    ],
    optionalWebsiteOrCompany: "northtrailgear.com",
  },
  B09KIT: {
    productName: "Professional Chef Knife 8 Inch - High Carbon German Steel",
    brand: "KitchenElite",
    sellerName: "KitchenElite Store",
    category: "Home & Kitchen",
    price: 49.95,
    rating: 4.4,
    bulletPoints: [
      "High carbon German steel blade for lasting sharpness",
      "Full tang construction for balance and durability",
      "Ergonomic triple-riveted handle reduces fatigue",
      "Hand-honed 15° angle per side razor edge",
      "NSF certified, professional grade",
    ],
    description:
      "Built for both amateur cooks and professional chefs, this 8-inch chef knife offers precision cutting and long-lasting performance. The German steel blade is resistant to corrosion and staining.",
    imageUrls: [
      "https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=1200&q=80",
    ],
    optionalWebsiteOrCompany: "kitchenelite.com",
  },
  B08PET: {
    productName: "Orthopedic Memory Foam Dog Bed for Large Dogs - Washable Cover",
    brand: "PawComfort",
    sellerName: "PawComfort Official",
    category: "Pet Supplies",
    price: 64.99,
    rating: 4.1,
    bulletPoints: [
      "3-inch thick certified memory foam base",
      "Removable, machine-washable microfiber cover",
      "Non-slip water-resistant bottom",
      "Available in 4 sizes for all breeds",
      "CertiPUR-US certified foam, no harmful chemicals",
    ],
    description:
      "Designed for aging dogs and active large breeds, this orthopedic bed relieves joint pressure and promotes deep sleep. The removable cover is machine washable for easy cleaning.",
    imageUrls: [
      "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=80",
    ],
    optionalWebsiteOrCompany: "pawcomfort.co",
  },
};

function findMockEntry(asin: string) {
  // Try exact prefix match first
  const prefix = asin.slice(0, 6).toUpperCase();
  if (MOCK_CATALOG[prefix]) return MOCK_CATALOG[prefix];

  // Generic fallback based on ASIN length parity for variety
  const keys = Object.keys(MOCK_CATALOG);
  const index = asin.charCodeAt(0) % keys.length;
  return MOCK_CATALOG[keys[index]];
}

export class MockPdpParserProvider implements PdpParserProvider {
  name = "MockPdpParserProvider";

  async parse(asin: string, _amazonDomain: string): Promise<PdpParseResult> {
    // Simulate network latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    const data = findMockEntry(asin);

    return {
      ok: true,
      asin,
      source: "Mock catalog (demo mode — configure RAINFOREST_API_KEY for live data)",
      data,
    };
  }
}
