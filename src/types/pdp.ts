export type ConfidenceLevel = "low" | "medium" | "high";

export type EntityType =
	| "seller"
	| "brand"
	| "company"
	| "manufacturer"
	| "supplier"
	| "unknown";

export type ImageRole =
	| "hero"
	| "lifestyle"
	| "infographic"
	| "dimensions"
	| "comparison"
	| "materials"
	| "benefits";

export type SafetyTag = "Amazon-safe" | "Preview-only";

export interface InputImage {
	id: string;
	name: string;
	url: string;
	source: "upload" | "url";
}

export interface ProductInput {
	amazonUrl: string;
	productName: string;
	brand: string;
	sellerName: string;
	category: string;
	price: number;
	rating: number;
	bulletPoints: string[];
	description: string;
	imageUrls: string[];
	images: InputImage[];
	optionalWebsiteOrCompany: string;
	targetStyle: "balanced" | "premium" | "technical" | "minimal";
}

export interface ScoreBreakdown {
	title: number;
	imageQuality: number;
	conversion: number;
	trust: number;
	completeness: number;
}

export interface AuditScore {
	overall: number;
	breakdown: ScoreBreakdown;
	diagnosis: string[];
	strengths: string[];
}

export interface TitleSuggestion {
	optimizedTitle: string;
	shorterVersion: string;
	conversionVersion: string;
	notes: string[];
}

export interface ImageConcept {
	id: string;
	sourceImageId: string | null;
	title: string;
	recommendedRole: ImageRole;
	improvementRecommendations: string[];
	premiumVisualDirection: string;
	conversionIntent: string;
	creativeBrief: string;
	overlayText: string | null;
	safetyTag: SafetyTag;
}

export interface ContactResult {
	detectedEntityName: string;
	entityType: EntityType;
	officialWebsite: string | null;
	publicEmail: string | null;
	alternativeContactPath: string;
	sourceLabel: string;
	confidence: ConfidenceLevel;
	confidenceScore: number;
	explanation: string;
}

export interface PreviewPdpModel {
	product: ProductInput;
	audit: AuditScore;
	titleSuggestion: TitleSuggestion;
	imageConcepts: ImageConcept[];
	contactResult: ContactResult;
}

export interface ExportPayload {
	generatedAt: string;
	referenceUrl: string;
	previewModel: PreviewPdpModel;
	summary: string;
	creativeBrief: string;
}
