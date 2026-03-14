import { ProductInput } from "@/types/pdp";

export const demoProduct: ProductInput = {
  amazonUrl: "https://www.amazon.com/dp/B0DEMO1234",
  productName: "Vacuum Insulated Stainless Steel Water Bottle 32oz",
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
  ],
  description:
    "A practical bottle built for workouts, commutes, and travel. Designed to maintain cold temperature while resisting dents and flavor transfer.",
  imageUrls: [
    "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1200&q=80",
  ],
  images: [
    {
      id: "img-1",
      name: "bottle-hero.jpg",
      url: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=1200&q=80",
      source: "url",
    },
    {
      id: "img-2",
      name: "bottle-lifestyle.jpg",
      url: "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=1200&q=80",
      source: "url",
    },
  ],
  optionalWebsiteOrCompany: "northtrailgear.com",
  targetStyle: "premium",
};
