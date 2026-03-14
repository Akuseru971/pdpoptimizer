import { auditProductInput } from "@/lib/scoring";
import { buildImageConcepts } from "@/lib/image-strategy";
import { generateTitleSuggestion } from "@/lib/title-optimizer";
import { findPublicContact } from "@/services/contact-finder";
import { PreviewPdpModel, ProductInput } from "@/types/pdp";

export async function buildPreviewModel(input: ProductInput): Promise<PreviewPdpModel> {
  const audit = auditProductInput(input);
  const titleSuggestion = generateTitleSuggestion(input);
  const imageConcepts = buildImageConcepts(input);
  const contact = await findPublicContact(input);

  return {
    product: input,
    audit,
    titleSuggestion,
    imageConcepts,
    contactResult: contact.result,
  };
}
