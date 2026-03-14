import { ContactResult, ProductInput } from "@/types/pdp";

export interface ContactFinderProvider {
  name: string;
  lookup(input: ProductInput): Promise<ContactResult>;
}
