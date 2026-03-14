import { create } from "zustand";
import { ProductInput } from "@/types/pdp";
import { demoProduct } from "@/mock/demo-product";

interface PdpStoreState {
  input: ProductInput;
  setInput: (input: ProductInput) => void;
  updateField: <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => void;
  resetToDemo: () => void;
}

const emptyProduct: ProductInput = {
  amazonUrl: "",
  productName: "",
  brand: "",
  sellerName: "",
  category: "Home & Kitchen",
  price: 0,
  rating: 0,
  bulletPoints: [""],
  description: "",
  imageUrls: [],
  images: [],
  optionalWebsiteOrCompany: "",
  targetStyle: "balanced",
};

function initialInput() {
  if (process.env.NODE_ENV === "development") {
    return demoProduct;
  }
  return emptyProduct;
}

export const usePdpStore = create<PdpStoreState>((set) => ({
  input: initialInput(),
  setInput: (input) => set({ input }),
  updateField: (key, value) =>
    set((state) => ({
      input: {
        ...state.input,
        [key]: value,
      },
    })),
  resetToDemo: () => set({ input: demoProduct }),
}));
