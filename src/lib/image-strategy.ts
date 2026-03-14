import { ImageConcept, ImageRole, ProductInput, SafetyTag } from "@/types/pdp";

const ROLE_ORDER: ImageRole[] = [
  "hero",
  "lifestyle",
  "infographic",
  "dimensions",
  "comparison",
  "materials",
  "benefits",
];

const ROLE_INTENT: Record<ImageRole, string> = {
  hero: "Stop the scroll with a clean first impression and clear product silhouette.",
  lifestyle: "Help shoppers visualize real-world use and emotional fit.",
  infographic: "Translate technical details into immediate value perception.",
  dimensions: "Reduce uncertainty and returns by clarifying sizing.",
  comparison: "Differentiate from alternatives and justify value.",
  materials: "Build quality trust through tactile close-up storytelling.",
  benefits: "Turn features into outcome-driven purchase motivation.",
};

const ROLE_OVERLAYS: Record<ImageRole, string | null> = {
  hero: null,
  lifestyle: "Designed for daily routines",
  infographic: "24h cold retention • Leak-proof cap",
  dimensions: "Fits cup holders • 32oz capacity",
  comparison: "More insulation, less condensation",
  materials: "304 stainless steel interior",
  benefits: "Hydrate longer with fewer refills",
};

function inferRole(index: number): ImageRole {
  return ROLE_ORDER[index % ROLE_ORDER.length];
}

function roleTitle(role: ImageRole) {
  switch (role) {
    case "hero":
      return "Primary Hero Refresh";
    case "lifestyle":
      return "Lifestyle Usage Scene";
    case "infographic":
      return "Feature Callout Infographic";
    case "dimensions":
      return "Dimension & Fit Visual";
    case "comparison":
      return "Comparison Value Panel";
    case "materials":
      return "Material Close-up Story";
    case "benefits":
      return "Benefit Outcome Graphic";
  }
}

function recommendationForRole(role: ImageRole): string[] {
  const map: Record<ImageRole, string[]> = {
    hero: [
      "Use bright neutral background and center framing.",
      "Increase edge sharpness and remove visual noise.",
      "Keep branding visible but subtle.",
    ],
    lifestyle: [
      "Place product in an aspirational but believable context.",
      "Use warm natural lighting and authentic props.",
      "Show hand interaction for scale clarity.",
    ],
    infographic: [
      "Use 2-4 concise callouts with icon support.",
      "Prioritize one technical claim per panel.",
      "Ensure typography remains readable on mobile.",
    ],
    dimensions: [
      "Add measurement arrows with clean labels.",
      "Include one familiar object for scale reference.",
      "Keep spacing generous to avoid visual clutter.",
    ],
    comparison: [
      "Use side-by-side layout with honest feature rows.",
      "Highlight only verifiable differentiators.",
      "Avoid negative competitor naming.",
    ],
    materials: [
      "Use macro crop to reveal finish and texture.",
      "Annotate key material specs.",
      "Apply soft contrast to retain premium look.",
    ],
    benefits: [
      "Lead with customer outcome, not technical jargon.",
      "Pair iconography with one-line benefit proof.",
      "Use high contrast text blocks for scanning.",
    ],
  };

  return map[role];
}

function safetyTagForRole(role: ImageRole): SafetyTag {
  return role === "hero" || role === "dimensions" ? "Amazon-safe" : "Preview-only";
}

export function buildImageConcepts(input: ProductInput): ImageConcept[] {
  const uploadedConcepts: ImageConcept[] = input.images.map((image, index) => {
    const role = inferRole(index);

    return {
      id: `concept-upload-${index + 1}`,
      sourceImageId: image.id,
      title: roleTitle(role),
      recommendedRole: role,
      improvementRecommendations: recommendationForRole(role),
      premiumVisualDirection:
        "Modern commercial style with controlled highlights, consistent color temperature, and minimal composition noise.",
      conversionIntent: ROLE_INTENT[role],
      creativeBrief: `Rework ${image.name} into a ${role} visual that prioritizes clarity, value communication, and premium product perception.`,
      overlayText: ROLE_OVERLAYS[role],
      safetyTag: safetyTagForRole(role),
    };
  });

  const additionalRoles: ImageRole[] = ["lifestyle", "infographic", "comparison"];
  const generatedConcepts = additionalRoles.map((role, index) => ({
    id: `concept-new-${index + 1}`,
    sourceImageId: null,
    title: roleTitle(role),
    recommendedRole: role,
    improvementRecommendations: recommendationForRole(role),
    premiumVisualDirection:
      "Editorial premium e-commerce art direction with strong visual hierarchy and buyer-first messaging.",
    conversionIntent: ROLE_INTENT[role],
    creativeBrief: `Create a net-new ${role} concept for ${input.productName} in ${input.category} to strengthen conversion confidence.`,
    overlayText: ROLE_OVERLAYS[role],
    safetyTag: safetyTagForRole(role),
  }));

  return [...uploadedConcepts, ...generatedConcepts];
}
