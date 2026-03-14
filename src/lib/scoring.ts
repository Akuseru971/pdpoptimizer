import { AuditScore, ProductInput } from "@/types/pdp";
import { clamp, countWords } from "@/lib/utils";

const BENEFIT_WORDS = [
  "easy",
  "durable",
  "fast",
  "safe",
  "premium",
  "comfortable",
  "leak",
  "bpa",
  "eco",
  "lightweight",
];

function scoreTitle(input: ProductInput) {
  const title = input.productName.trim();
  if (!title) return 0;

  const words = countWords(title);
  let score = 50;

  if (words >= 8 && words <= 20) score += 20;
  else if (words >= 5 && words <= 25) score += 10;
  else score -= 10;

  if (input.brand && title.toLowerCase().includes(input.brand.toLowerCase())) score += 8;
  if (input.category && title.toLowerCase().includes(input.category.toLowerCase().split(" ")[0])) score += 4;

  const lower = title.toLowerCase();
  const repeated = new Set(
    lower
      .split(/\W+/)
      .filter(Boolean)
      .filter((word, _, arr) => arr.filter((w) => w === word).length > 2),
  );
  if (repeated.size > 0) score -= 12;

  if (/!|\*|\bbest\b|\bguaranteed\b/i.test(title)) score -= 12;

  return clamp(score);
}

function scoreImageQuality(input: ProductInput) {
  let score = 35;
  const imageCount = input.images.length + input.imageUrls.length;

  if (imageCount >= 6) score += 30;
  else if (imageCount >= 4) score += 18;
  else if (imageCount >= 2) score += 10;
  else score -= 10;

  const longDescription = input.description.length > 160;
  if (longDescription) score += 6;

  if (imageCount > 0) score += 8;

  return clamp(score);
}

function scoreConversion(input: ProductInput) {
  let score = 30;

  const bulletCount = input.bulletPoints.filter(Boolean).length;
  if (bulletCount >= 5) score += 20;
  else if (bulletCount >= 3) score += 12;
  else score -= 8;

  const benefitsMentioned = input.bulletPoints
    .join(" ")
    .toLowerCase()
    .split(/\W+/)
    .filter((token) => BENEFIT_WORDS.includes(token)).length;

  score += Math.min(15, benefitsMentioned * 3);

  if (input.price > 0) score += 8;
  if (input.rating >= 4.2) score += 12;
  else if (input.rating >= 3.8) score += 8;

  return clamp(score);
}

function scoreTrust(input: ProductInput) {
  let score = 28;

  if (input.brand) score += 12;
  if (input.sellerName) score += 8;
  if (input.optionalWebsiteOrCompany) score += 12;

  if (input.rating >= 4) score += 14;
  else if (input.rating >= 3.5) score += 8;
  else score -= 8;

  if (input.description.length > 220) score += 10;

  return clamp(score);
}

function scoreCompleteness(input: ProductInput) {
  const checks = [
    Boolean(input.amazonUrl),
    Boolean(input.productName),
    Boolean(input.brand),
    Boolean(input.sellerName),
    Boolean(input.category),
    input.price > 0,
    input.rating > 0,
    input.bulletPoints.filter(Boolean).length > 0,
    input.description.trim().length > 0,
    input.images.length + input.imageUrls.length > 0,
  ];

  const completeRatio = checks.filter(Boolean).length / checks.length;
  return clamp(Math.round(completeRatio * 100));
}

function buildDiagnosis(input: ProductInput, score: AuditScore["breakdown"]) {
  const diagnosis: string[] = [];
  const strengths: string[] = [];

  if (score.title < 60) diagnosis.push("Title feels too generic and needs clearer benefit-first structure.");
  else strengths.push("Title has a usable structure and can be optimized further.");

  const imageCount = input.images.length + input.imageUrls.length;
  if (imageCount < 4) diagnosis.push("Not enough benefit-led visuals; add lifestyle, dimensions, and comparison images.");
  if (imageCount <= 1) diagnosis.push("Weak visual stack: only one image cannot answer core buyer questions.");
  if (!input.description.toLowerCase().includes("material")) diagnosis.push("Missing material explanation for trust and quality perception.");
  if (!input.description.toLowerCase().includes("size") && !input.bulletPoints.join(" ").toLowerCase().includes("size")) {
    diagnosis.push("Missing dimension and usage context in content.");
  }
  if (score.trust < 60) diagnosis.push("Trust signals are limited; add stronger brand story and support details.");

  if (score.conversion >= 70) strengths.push("Conversion intent in bullets is already visible.");
  if (score.imageQuality >= 65) strengths.push("Current image set is a solid baseline for premium iteration.");

  if (!diagnosis.length) {
    diagnosis.push("Listing is solid overall; improvements should focus on premium storytelling and visual hierarchy.");
  }

  return { diagnosis, strengths };
}

export function auditProductInput(input: ProductInput): AuditScore {
  const breakdown = {
    title: scoreTitle(input),
    imageQuality: scoreImageQuality(input),
    conversion: scoreConversion(input),
    trust: scoreTrust(input),
    completeness: scoreCompleteness(input),
  };

  const overall = clamp(
    Math.round(
      breakdown.title * 0.22 +
        breakdown.imageQuality * 0.22 +
        breakdown.conversion * 0.22 +
        breakdown.trust * 0.2 +
        breakdown.completeness * 0.14,
    ),
  );

  const { diagnosis, strengths } = buildDiagnosis(input, breakdown);

  return {
    overall,
    breakdown,
    diagnosis,
    strengths,
  };
}
