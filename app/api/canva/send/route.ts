// Per-session endpoint: receives the composited image, uploads it as a Canva
// asset, creates a new design from it, and returns the design's edit URL.

import { NextRequest, NextResponse } from "next/server";
import { createDesign, uploadAsset } from "@/lib/canva";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { image?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const match = body.image?.match(/^data:image\/(jpeg|png);base64,(.+)$/);
  if (!match) {
    return NextResponse.json(
      { error: "Expected `image` as a JPEG/PNG data URL" },
      { status: 400 },
    );
  }

  const title =
    body.title?.slice(0, 80) || `Fishbowl ${new Date().toISOString().slice(0, 16)}`;

  try {
    const assetId = await uploadAsset(Buffer.from(match[2], "base64"), title);
    const editUrl = await createDesign(assetId, title);
    return NextResponse.json({ ok: true, editUrl });
  } catch (e) {
    console.error("Canva send failed:", e);
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
