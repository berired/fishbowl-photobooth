// Server-only Canva Connect helpers: one admin token pair lives in Upstash
// Redis under a fixed key; every kiosk session reuses it. Uses only free-tier
// endpoints (asset-uploads + create design) — no Autofill / Brand Templates.

import { Redis } from "@upstash/redis";

const TOKEN_KEY = "canva:token";
const CANVA_API = "https://api.canva.com/rest/v1";
export const CANVA_AUTH_URL = "https://www.canva.com/api/oauth/authorize";
const CANVA_TOKEN_URL = `${CANVA_API}/oauth/token`;

export type TokenSet = {
  access_token: string;
  refresh_token: string;
  /** Unix ms when the access token expires. */
  expires_at: number;
};

function redis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Upstash Redis is not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).",
    );
  }
  return new Redis({ url, token });
}

function clientCredentials(): { id: string; basic: string } {
  const id = process.env.CANVA_CLIENT_ID;
  const secret = process.env.CANVA_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Canva is not configured (CANVA_CLIENT_ID / CANVA_CLIENT_SECRET).");
  }
  return { id, basic: Buffer.from(`${id}:${secret}`).toString("base64") };
}

async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
  const { basic } = clientCredentials();
  const res = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) {
    throw new Error(`Canva token request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

export async function exchangeCode(code: string, verifier: string, redirectUri: string) {
  const { id } = clientCredentials();
  const tokens = await tokenRequest({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    client_id: id,
    redirect_uri: redirectUri,
  });
  await redis().set(TOKEN_KEY, tokens);
  return tokens;
}

/** Returns a valid access token, refreshing (and re-persisting) if needed. */
export async function getAccessToken(): Promise<string> {
  const stored = await redis().get<TokenSet>(TOKEN_KEY);
  if (!stored) {
    throw new Error("Canva is not connected yet. Run the one-time /api/canva/authorize flow.");
  }
  if (Date.now() < stored.expires_at - 60_000) return stored.access_token;

  // Canva rotates refresh tokens — always persist the new pair.
  const refreshed = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: stored.refresh_token,
  });
  await redis().set(TOKEN_KEY, refreshed);
  return refreshed.access_token;
}

async function canvaFetch(path: string, token: string, init?: RequestInit) {
  const res = await fetch(`${CANVA_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...init?.headers },
  });
  if (!res.ok) {
    throw new Error(`Canva API ${path} failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** Upload an image binary as a Canva asset; polls the job until it resolves. */
export async function uploadAsset(image: Buffer, name: string): Promise<string> {
  const token = await getAccessToken();
  const job = (await canvaFetch("/asset-uploads", token, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Asset-Upload-Metadata": JSON.stringify({
        name_base64: Buffer.from(name).toString("base64"),
      }),
    },
    body: new Uint8Array(image),
  })) as { job: { id: string; status: string; asset?: { id: string } } };

  const { id } = job.job;
  let { status, asset } = job.job;
  const deadline = Date.now() + 60_000;
  while (status === "in_progress") {
    if (Date.now() > deadline) throw new Error("Canva asset upload timed out.");
    await new Promise((r) => setTimeout(r, 750));
    const poll = (await canvaFetch(`/asset-uploads/${id}`, token)) as {
      job: { status: string; asset?: { id: string }; error?: { message: string } };
    };
    status = poll.job.status;
    asset = poll.job.asset;
    if (status === "failed") {
      throw new Error(`Canva asset upload failed: ${poll.job.error?.message ?? "unknown"}`);
    }
  }
  if (!asset?.id) throw new Error("Canva asset upload finished without an asset id.");
  return asset.id;
}

/** Create a new design pre-loaded with the uploaded asset. */
export async function createDesign(assetId: string, title: string): Promise<string> {
  const token = await getAccessToken();
  const data = (await canvaFetch("/designs", token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      design_type: { type: "preset", name: "doc" },
      asset_id: assetId,
      title,
    }),
  })) as { design: { urls: { edit_url: string } } };
  return data.design.urls.edit_url;
}
