# Fishbowl — photobooth kiosk

A single-route, kiosk-style photobooth web app. Customers pick a package
(bubble type), pick a frame, take a burst of 6 webcam photos with a countdown,
select their favorites, and the composited image is sent into a new Canva
design via the Canva Connect API (free-tier Create Design endpoint — no
Enterprise Autofill). The app then loops back to the attract screen for the
next customer.

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS 4
- Zustand for client session state (no accounts, no per-user DB)
- Upstash Redis (or Vercel KV) — stores exactly one thing: the admin Canva
  OAuth token pair
- Deploys to Vercel

## Run locally

```bash
npm install
npm run dev
```

The whole kiosk flow (attract → selection → capture → review) works without
any environment variables — only the final "Confirm & Send" step needs the
Canva/Redis setup below (it fails gracefully with a retry until configured).

## Canva setup (one time)

1. Create a free Canva Developer account and register a **private
   integration** at [canva.com/developers](https://www.canva.com/developers).
   Enable the `asset:write`, `design:content:write`, and `design:meta:read`
   scopes.
2. Add the OAuth redirect URI: `https://<your-domain>/api/canva/callback`
   (plus `http://127.0.0.1:3000/api/canva/callback` for local testing).
3. Create an Upstash Redis database (or Vercel KV) and copy its REST URL and
   token.
4. Copy `.env.example` to `.env.local` and fill in all values.
5. Visit `/api/canva/authorize` (append `?key=<CANVA_ADMIN_KEY>` if you set
   one) **once**, signed in as the business Canva account, and approve. Tokens
   are stored in Redis and refreshed automatically from then on — customers
   never see this.

### Per-session flow

`POST /api/canva/send` uploads the composited JPEG via `POST
/v1/asset-uploads` (polling the job), then calls `POST /v1/designs` with the
asset id. The new design lands in the connected Canva account's projects.

**Caveats** (by design of the free-tier approach): all designs land in one
Canva account; designs never opened within ~7 days may be auto-deleted by
Canva; the returned edit URL is valid for 30 days.

## Layout of interest

| Path | What it is |
| --- | --- |
| `app/page.tsx` | Single-route kiosk shell — pages are client state, not URLs |
| `components/MainPage.tsx` | Attract screen (idle bubbles, tap to start) |
| `components/SelectionPage.tsx` | Bubble type → frame design steps |
| `components/CapturePage.tsx` | Start modal, burst ×6, retake check, photo selection, final review, sending, done |
| `lib/frames.ts` | The 7 frame designs as canvas draw functions (previews and final composite share this code) |
| `lib/composite.ts` | Canvas compositing (photos + frame → JPEG data URL) |
| `lib/store.ts` | Zustand session state; resets fully between customers |
| `lib/config.ts` | Countdown length, burst count, done-screen dwell |
| `lib/canva.ts` + `app/api/canva/*` | Server-side Canva OAuth + send pipeline |

## Kiosk notes

- The burst always captures 6 photos; "Retake" redoes all 6. Only after
  accepting the burst does the customer select the package's required count
  (4 / 3 / 1).
- The camera stream stays mounted through burst + retakes (one permission
  prompt per session) and is released once photo selection starts.
- Countdown length is `COUNTDOWN_SECONDS` in `lib/config.ts` (currently 10s).
- Frames are CSS/canvas placeholders — swap the draw functions in
  `lib/frames.ts` for PNG overlays later without touching capture logic.
