// Shared-password gate for the kiosk. There are no user accounts — every
// browser that knows the staff password gets the same long-lived cookie
// until someone taps Logout.

import { createHash, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "fb_auth";
// A year: the cookie should outlast the kiosk being left running for weeks,
// not force a re-entry every session. Logout is the only way to clear it.
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function kioskPassword(): string {
  const pw = process.env.KIOSK_PASSWORD;
  if (!pw) throw new Error("KIOSK_PASSWORD is not set");
  return pw;
}

function tokenFor(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

/** The cookie value a correctly-authed browser should hold right now. */
export function validToken(): string {
  return tokenFor(kioskPassword());
}

export function checkPassword(candidate: string): boolean {
  const expected = Buffer.from(validToken());
  const actual = Buffer.from(tokenFor(candidate));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const AUTH_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  maxAge: COOKIE_MAX_AGE,
  path: "/",
};
