import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_COOKIE_OPTS, checkPassword, validToken } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, validToken(), {
    ...AUTH_COOKIE_OPTS,
    secure: req.nextUrl.protocol === "https:",
  });
  return res;
}
