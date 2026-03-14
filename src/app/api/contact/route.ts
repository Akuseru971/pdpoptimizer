import { NextResponse } from "next/server";
import { findPublicContact } from "@/services/contact-finder";
import { ProductInput } from "@/types/pdp";

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as ProductInput;
    const data = await findPublicContact(input);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to look up contact",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
