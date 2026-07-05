// OAuth redirect target: exchanges the code for a token pair and stores it in
// Redis. After this succeeds once, the kiosk runs unattended.

import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/canva";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const verifier = req.cookies.get("canva_verifier")?.value;
  const expectedState = req.cookies.get("canva_state")?.value;

  const canvaError = req.nextUrl.searchParams.get("error");
  if (canvaError) {
    const description = req.nextUrl.searchParams.get("error_description");
    return NextResponse.json(
      { error: `Canva returned an error: ${canvaError}${description ? ` — ${description}` : ""}` },
      { status: 400 },
    );
  }
  if (!code) {
    return NextResponse.json(
      { error: "No authorization code in the callback — start again at /api/canva/authorize" },
      { status: 400 },
    );
  }
  if (!verifier) {
    return NextResponse.json(
      {
        error:
          "PKCE verifier cookie missing. Start at /api/canva/authorize and finish in the same browser, using the same host (127.0.0.1) throughout.",
      },
      { status: 400 },
    );
  }
  if (!state || state !== expectedState) {
    return NextResponse.json({ error: "State mismatch — start again" }, { status: 400 });
  }

  try {
    const redirectUri = new URL("/api/canva/callback", req.nextUrl.origin).toString();
    await exchangeCode(code, verifier, redirectUri);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  const res = new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Canva connected</title>
     <body style="font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">
       <div style="text-align:center">
         <h1>✅ Canva connected</h1>
         <p>The kiosk can now send designs to this Canva account. You can close this tab.</p>
       </div>
     </body>`,
    { headers: { "Content-Type": "text/html" } },
  );
  res.cookies.delete("canva_verifier");
  res.cookies.delete("canva_state");
  return res;
}
