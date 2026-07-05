// One-time admin OAuth kickoff (PKCE). Visit this route once as the business
// owner to connect the kiosk's Canva account. Not used by customers.

import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { CANVA_AUTH_URL, env } from "@/lib/canva";

export const runtime = "nodejs";

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function GET(req: NextRequest) {
  // Optional gate so a walk-up customer can't trigger a re-auth.
  const adminKey = env("CANVA_ADMIN_KEY");
  if (adminKey && req.nextUrl.searchParams.get("key") !== adminKey) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = env("CANVA_CLIENT_ID");
  if (!clientId) {
    return NextResponse.json({ error: "CANVA_CLIENT_ID is not set" }, { status: 500 });
  }

  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(16));
  const redirectUri = new URL("/api/canva/callback", req.nextUrl.origin).toString();

  const url = new URL(CANVA_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set(
    "scope",
    "asset:read asset:write design:content:write design:meta:read folder:write",
  );
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "s256");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  // secure cookies only over https — on http://127.0.0.1 some browsers would
  // silently drop them, losing the PKCE verifier before the callback
  const cookieOpts = {
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    // generous window: a first-time Canva sign-in with MFA can take a while
    maxAge: 1800,
    path: "/",
  };
  res.cookies.set("canva_verifier", verifier, cookieOpts);
  res.cookies.set("canva_state", state, cookieOpts);
  return res;
}
