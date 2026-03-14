/**
 * Extracts the Amazon ASIN from any common Amazon product URL format.
 * Returns null if no ASIN is found.
 *
 * Supported formats:
 *  - amazon.com/dp/ASIN
 *  - amazon.com/gp/product/ASIN
 *  - amazon.com/product-title/dp/ASIN/...
 *  - amzn.to short links (after redirect – ASIN not extractable client-side, returns null)
 */
export function extractAsin(url: string): string | null {
  if (!url) return null;

  // /dp/ASIN  or  /gp/product/ASIN
  const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  if (match) return match[1].toUpperCase();

  return null;
}

export function isAmazonUrl(url: string): boolean {
  return /amazon\.[a-z.]{2,6}/.test(url);
}

export function amazonDomainFromUrl(url: string): string {
  const match = url.match(/amazon\.([a-z.]{2,6})/i);
  return match ? `amazon.${match[1]}` : "amazon.com";
}
