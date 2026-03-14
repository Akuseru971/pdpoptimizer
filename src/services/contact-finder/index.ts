import { MockContactFinderProvider } from "@/services/contact-finder/providers/mock-provider";
import { SearchApiContactFinderProvider } from "@/services/contact-finder/providers/search-api-provider";
import { ContactFinderProvider } from "@/services/contact-finder/types";
import { ProductInput } from "@/types/pdp";

function getProvider(): ContactFinderProvider {
  if (process.env.CONTACT_PROVIDER === "search-api") {
    return new SearchApiContactFinderProvider();
  }
  return new MockContactFinderProvider();
}

export async function findPublicContact(input: ProductInput) {
  const provider = getProvider();
  const result = await provider.lookup(input);
  return {
    provider: provider.name,
    result,
  };
}
