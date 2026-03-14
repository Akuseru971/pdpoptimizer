import { ProductInput, TitleSuggestion } from "@/types/pdp";
import { normalizeText } from "@/lib/utils";

const STYLE_DESCRIPTORS: Record<ProductInput["targetStyle"], string[]> = {
  balanced: ["reliable", "everyday", "practical"],
  premium: ["premium", "elevated", "high-performance"],
  technical: ["engineered", "precision", "advanced"],
  minimal: ["clean", "simple", "essential"],
};

function dedupeWords(value: string) {
  const seen = new Set<string>();
  return value
    .split(" ")
    .filter(Boolean)
    .filter((word) => {
      const token = word.toLowerCase();
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    })
    .join(" ");
}

function sanitizeTitle(value: string) {
  return normalizeText(value)
    .replace(/[!@#$%^*_=+{}<>~`|]+/g, "")
    .replace(/\s*[-,:;]\s*$/, "");
}

function buildBaseParts(input: ProductInput) {
  const keyFeatures = input.bulletPoints
    .slice(0, 3)
    .map((bullet) => bullet.replace(/\.$/, ""))
    .map((bullet) => bullet.split(",")[0]);

  const styleWord = STYLE_DESCRIPTORS[input.targetStyle][0];

  return [
    input.brand,
    input.productName,
    input.category,
    keyFeatures[0],
    styleWord,
  ].filter(Boolean);
}

function trimToWords(value: string, maxWords: number) {
  const words = value.split(" ").filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

export function generateTitleSuggestion(input: ProductInput): TitleSuggestion {
  const base = buildBaseParts(input).join(" - ");
  const cleaned = sanitizeTitle(dedupeWords(base));

  const optimizedTitle = trimToWords(cleaned, 22);
  const shorterVersion = trimToWords(
    sanitizeTitle(`${input.brand} ${input.productName} ${STYLE_DESCRIPTORS[input.targetStyle][1]}`),
    12,
  );

  const conversionVersion = trimToWords(
    sanitizeTitle(
      `${input.brand} ${input.productName} for ${input.category} - ${input.bulletPoints[0] ?? "Built for daily use"}`,
    ),
    24,
  );

  const notes = [
    "Reordered title to lead with brand and core product intent.",
    "Removed repeated terms and noisy punctuation for cleaner readability.",
    "Added one style-driven descriptor to improve perceived positioning without keyword stuffing.",
    "Kept structure Amazon-friendly with natural language and no spam formatting.",
  ];

  return {
    optimizedTitle,
    shorterVersion,
    conversionVersion,
    notes,
  };
}
