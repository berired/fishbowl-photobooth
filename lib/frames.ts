// Frame catalog. Each frame is defined as a canvas composition (background +
// photo slots + foreground) so the on-screen preview and the final composite
// are drawn by the exact same code. When real PNG overlays exist later, only
// the draw functions here need to change — capture/compositing stay as-is.

// ---- packages ----------------------------------------------------------------
// The customer picks a package (fish) first, then one of its two variants.
// The variant's strip type decides the frame layout and how many photos get
// picked (half strip = 3, full strip = 4). Extras (sticker copy, keychain)
// don't change the capture flow except Lapu-Lapu, which adds a "pick 1 photo
// for the keychain" step after strip photo selection.

export type StripType = "half" | "full";

export const STRIP_PHOTO_COUNT: Record<StripType, number> = {
  half: 3,
  full: 4,
};

export type PackageVariant = {
  id: string;
  label: string;
  /** What the customer gets, verbatim from the price list. */
  description: string;
  stripType: StripType;
};

/** Representative finished-design sample per strip type (variant cards). */
export const STRIP_SAMPLE: Record<StripType, string> = {
  half: "/assets/Samples/thumbs/3 Bubbles - Fih..webp",
  full: "/assets/Samples/thumbs/4 Bubbles - Fih..webp",
};

export const KEYCHAIN_SAMPLE = "/assets/ui/keychain-sample.svg";

export type PackageId = "bangus" | "tilapia" | "lapu-lapu";

export type Package = {
  id: PackageId;
  name: string;
  tagline: string;
  /** Finished-design samples shown on the package card. */
  samples: string[];
  /** Lapu-Lapu: adds the keychain photo pick + keychain composite. */
  keychain: boolean;
  variants: [PackageVariant, PackageVariant];
};

export const PACKAGES: Package[] = [
  {
    id: "bangus",
    name: "Bangus",
    tagline: "2 Photostrip",
    samples: [
      "/assets/Samples/thumbs/3 Bubbles - Sea U Later.webp",
      "/assets/Samples/thumbs/4 Bubbles - Sea U Later.webp",
    ],
    keychain: false,
    variants: [
      { id: "basic-a", label: "Basic A", description: "2 Half Strips", stripType: "half" },
      { id: "basic-b", label: "Basic B", description: "2 Full Strips", stripType: "full" },
    ],
  },
  {
    id: "tilapia",
    name: "Tilapia",
    tagline: "1 Photostrip + 1 Sticker",
    samples: [
      "/assets/Samples/thumbs/3 Bubbles - Nemo.webp",
      "/assets/Samples/thumbs/4 Bubbles - Nemo.webp",
    ],
    keychain: false,
    variants: [
      {
        id: "sticker-a",
        label: "Sticker A",
        description: "1 Half Strip + Sticker Strip",
        stripType: "half",
      },
      {
        id: "sticker-b",
        label: "Sticker B",
        description: "1 Full Strip + 1 Sticker Strip",
        stripType: "full",
      },
    ],
  },
  {
    id: "lapu-lapu",
    name: "Lapu-Lapu",
    tagline: "1 Photostrip + 1 Keychain",
    samples: [
      "/assets/Samples/thumbs/3 Bubbles - Fih..webp",
      "/assets/ui/keychain-sample.svg",
    ],
    keychain: true,
    variants: [
      {
        id: "keychain-a",
        label: "Keychain A",
        description: "1 Half Strip + Bubble Keychain",
        stripType: "half",
      },
      {
        id: "keychain-b",
        label: "Keychain B",
        description: "1 Full Strip + Bubble Keychain",
        stripType: "full",
      },
    ],
  },
];

export function packageById(id: PackageId): Package {
  return PACKAGES.find((p) => p.id === id)!;
}

// ---- frames -------------------------------------------------------------------

export type FrameLayout = "half-strip" | "full-strip" | "keychain";

export type Slot = {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Corner radius for the photo cutout; ignored when `circle` is set. */
  r?: number;
  /** Circular cutout (keychain). */
  circle?: boolean;
};

export type Frame = {
  id: string;
  name: string;
  layout: FrameLayout;
  width: number;
  height: number;
  slots: Slot[];
  /** Finished-design sample shown on the frame picker (public/ path). */
  sample?: string;
  /**
   * Real frame artwork (public/ path). When set, the composite draws this
   * image full-bleed, then places the photos into the slots on top of it —
   * the canvas draw functions below are ignored.
   */
  overlay?: string;
  drawBackground: (ctx: CanvasRenderingContext2D) => void;
  drawForeground?: (ctx: CanvasRenderingContext2D, displayFont: string) => void;
};

// ---- palette (kept in sync with globals.css) --------------------------------

const WATER = "#0E3E4A";
const POOL = "#BFE8E4";
const FOAM = "#F6FBFA";
const GOLD = "#FF7A2F";
const FIN = "#FFB25E";
const KELP = "#157A8C";

// ---- shared drawing helpers -------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Deterministic scatter of glassy bubbles. */
function bubbles(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string,
  seeds: [number, number, number][], // x%, y%, radius px
) {
  ctx.save();
  for (const [px, py, r] of seeds) {
    const x = (px / 100) * w;
    const y = (py / 100) * h;
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, r * 0.12);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    // highlight arc — makes the circle read as a bubble, not a ring
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.62, Math.PI * 1.1, Math.PI * 1.55);
    ctx.stroke();
  }
  ctx.restore();
}

function wordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  size: number,
  color: string,
  displayFont: string,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px ${displayFont}`;
  ctx.fillText("fishbowl", cx, y);
  ctx.font = `600 ${Math.round(size * 0.32)}px ${displayFont}`;
  ctx.globalAlpha = 0.75;
  const date = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  ctx.fillText(date, cx, y + size * 0.78);
  ctx.restore();
}

// ---- slot layouts per strip type ---------------------------------------------

// Half strip: 600×1800, 3 stacked, footer band.
const ST = { w: 600, h: 1800, m: 46, gap: 32, footer: 196 };
const stCellH = (ST.h - ST.m - ST.footer - ST.gap * 2 - 36) / 3;
const halfStripSlots: Slot[] = [0, 1, 2].map((i) => ({
  x: ST.m,
  y: ST.m + i * (stCellH + ST.gap),
  w: ST.w - ST.m * 2,
  h: stCellH,
  r: 16,
}));

// Full strip: 1414×2000 (double the half strip's width — the real artwork's
// native size), 2×2 grid, footer band. Placeholder slots until overlay PNGs
// arrive; the real designs use circular bubble windows.
const FS = { w: 1414, h: 2000, m: 80, gap: 44, footer: 220 };
const fsCellW = (FS.w - FS.m * 2 - FS.gap) / 2;
const fsCellH = (FS.h - FS.m - FS.footer - FS.gap - 40) / 2;
const fullStripSlots: Slot[] = [0, 1, 2, 3].map((i) => ({
  x: FS.m + (i % 2) * (fsCellW + FS.gap),
  y: FS.m + Math.floor(i / 2) * (fsCellH + FS.gap),
  w: fsCellW,
  h: fsCellH,
  r: 20,
}));

// Keychain: 900×900 tag with a circular photo window.
const KC = { w: 900, h: 900 };
const keychainSlots: Slot[] = [{ x: 170, y: 210, w: 560, h: 560, circle: true }];

// ---- the frames ----------------------------------------------------------------

export const FRAMES: Frame[] = [
  // ---- half strip (3 designs) ----
  {
    id: "st-fih",
    name: "Fih.",
    layout: "half-strip",
    // Procedural placeholder until the overlay PNG is re-delivered (the old
    // "3 Bubbles - Fih Transparent.png" was removed from public/assets).
    width: ST.w,
    height: ST.h,
    slots: halfStripSlots,
    sample: "/assets/Samples/thumbs/3 Bubbles - Fih..webp",
    drawBackground(ctx) {
      ctx.fillStyle = FOAM;
      ctx.fillRect(0, 0, ST.w, ST.h);
      // sprocket-hole edges — photo-strip vernacular
      ctx.fillStyle = POOL;
      for (let y = 60; y < ST.h - 40; y += 90) {
        ctx.beginPath();
        ctx.arc(18, y, 8, 0, Math.PI * 2);
        ctx.arc(ST.w - 18, y + 45, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, ST.w / 2, ST.h - ST.footer / 2 - 6, 60, WATER, font);
      bubbles(ctx, ST.w, ST.h, KELP, [[18, 93.5, 10], [82, 94.5, 13]]);
    },
  },
  {
    id: "st-nemo",
    name: "Nemo",
    layout: "half-strip",
    width: ST.w,
    height: ST.h,
    slots: halfStripSlots,
    sample: "/assets/Samples/thumbs/3 Bubbles - Nemo.webp",
    drawBackground(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, ST.h);
      g.addColorStop(0, "#12505F");
      g.addColorStop(1, WATER);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ST.w, ST.h);
      bubbles(ctx, ST.w, ST.h, POOL, [
        [10, 4, 20], [90, 2.5, 14], [8, 97, 16], [88, 96, 22], [50, 98, 10],
      ]);
      for (const s of halfStripSlots) {
        roundRect(ctx, s.x - 10, s.y - 10, s.w + 20, s.h + 20, (s.r ?? 0) + 8);
        ctx.fillStyle = FOAM;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, ST.w / 2, ST.h - ST.footer / 2 - 6, 60, POOL, font);
    },
  },
  {
    id: "st-sea-u-later",
    name: "Sea U Later",
    layout: "half-strip",
    width: ST.w,
    height: ST.h,
    slots: halfStripSlots,
    sample: "/assets/Samples/thumbs/3 Bubbles - Sea U Later.webp",
    drawBackground(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, ST.h);
      g.addColorStop(0, FIN);
      g.addColorStop(1, GOLD);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, ST.w, ST.h);
      bubbles(ctx, ST.w, ST.h, FOAM, [
        [12, 3, 18], [88, 5, 24], [10, 96, 20], [90, 97, 14],
      ]);
      for (const s of halfStripSlots) {
        roundRect(ctx, s.x - 10, s.y - 10, s.w + 20, s.h + 20, (s.r ?? 0) + 8);
        ctx.fillStyle = FOAM;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, ST.w / 2, ST.h - ST.footer / 2 - 6, 60, FOAM, font);
    },
  },

  // ---- full strip (3 designs; procedural until overlay PNGs arrive) ----
  {
    id: "fs-fih",
    name: "Fih.",
    layout: "full-strip",
    width: FS.w,
    height: FS.h,
    slots: fullStripSlots,
    sample: "/assets/Samples/thumbs/4 Bubbles - Fih..webp",
    drawBackground(ctx) {
      ctx.fillStyle = FOAM;
      ctx.fillRect(0, 0, FS.w, FS.h);
      ctx.fillStyle = POOL;
      for (let y = 60; y < FS.h - 40; y += 90) {
        ctx.beginPath();
        ctx.arc(18, y, 8, 0, Math.PI * 2);
        ctx.arc(FS.w - 18, y + 45, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const s of fullStripSlots) {
        roundRect(ctx, s.x - 10, s.y - 10, s.w + 20, s.h + 20, (s.r ?? 0) + 8);
        ctx.fillStyle = POOL;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, FS.w / 2, FS.h - FS.footer / 2 - 6, 60, WATER, font);
      bubbles(ctx, FS.w, FS.h, KELP, [[18, 95, 10], [82, 95.8, 13]]);
    },
  },
  {
    id: "fs-nemo",
    name: "Nemo",
    layout: "full-strip",
    width: FS.w,
    height: FS.h,
    slots: fullStripSlots,
    sample: "/assets/Samples/thumbs/4 Bubbles - Nemo.webp",
    drawBackground(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, FS.h);
      g.addColorStop(0, "#12505F");
      g.addColorStop(1, WATER);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FS.w, FS.h);
      bubbles(ctx, FS.w, FS.h, POOL, [
        [10, 3, 20], [90, 2, 14], [8, 97.5, 16], [88, 97, 22], [50, 98.5, 10],
      ]);
      for (const s of fullStripSlots) {
        roundRect(ctx, s.x - 10, s.y - 10, s.w + 20, s.h + 20, (s.r ?? 0) + 8);
        ctx.fillStyle = FOAM;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, FS.w / 2, FS.h - FS.footer / 2 - 6, 60, POOL, font);
    },
  },
  {
    id: "fs-sea-u-later",
    name: "Sea U Later",
    layout: "full-strip",
    width: FS.w,
    height: FS.h,
    slots: fullStripSlots,
    sample: "/assets/Samples/thumbs/4 Bubbles - Sea U Later.webp",
    drawBackground(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, FS.h);
      g.addColorStop(0, FIN);
      g.addColorStop(1, GOLD);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, FS.w, FS.h);
      bubbles(ctx, FS.w, FS.h, FOAM, [
        [12, 2.5, 18], [88, 4, 24], [10, 97, 20], [90, 97.8, 14],
      ]);
      for (const s of fullStripSlots) {
        roundRect(ctx, s.x - 10, s.y - 10, s.w + 20, s.h + 20, (s.r ?? 0) + 8);
        ctx.fillStyle = FOAM;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, FS.w / 2, FS.h - FS.footer / 2 - 6, 60, FOAM, font);
    },
  },

  // ---- keychain (1 design; applied automatically for Lapu-Lapu) ----
  {
    id: "kc-bubble",
    name: "Bubble Tag",
    layout: "keychain",
    width: KC.w,
    height: KC.h,
    slots: keychainSlots,
    sample: "/assets/ui/keychain-sample.svg",
    drawBackground(ctx) {
      ctx.fillStyle = POOL;
      ctx.fillRect(0, 0, KC.w, KC.h);
      roundRect(ctx, 60, 60, KC.w - 120, KC.h - 120, 80);
      ctx.fillStyle = FOAM;
      ctx.fill();
      // keychain hole
      ctx.beginPath();
      ctx.arc(KC.w / 2, 128, 34, 0, Math.PI * 2);
      ctx.fillStyle = POOL;
      ctx.fill();
      ctx.lineWidth = 10;
      ctx.strokeStyle = WATER;
      ctx.stroke();
      // ring around the photo window
      const s = keychainSlots[0];
      ctx.beginPath();
      ctx.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 2 + 16, 0, Math.PI * 2);
      ctx.fillStyle = GOLD;
      ctx.fill();
    },
    drawForeground(ctx, font) {
      wordmark(ctx, KC.w / 2, KC.h - 78, 54, WATER, font);
      bubbles(ctx, KC.w, KC.h, KELP, [[14, 14, 16], [87, 17, 22], [90, 84, 14], [11, 86, 20]]);
    },
  },
];

// Picker order matches the mockup: Sea U Later, Nemo, Fih.
const PICKER_ORDER = ["Sea U Later", "Nemo", "Fih."];

export function framesFor(stripType: StripType): Frame[] {
  const layout: FrameLayout = stripType === "half" ? "half-strip" : "full-strip";
  return FRAMES.filter((f) => f.layout === layout).sort(
    (a, b) => PICKER_ORDER.indexOf(a.name) - PICKER_ORDER.indexOf(b.name),
  );
}

/** The single keychain frame, used automatically by the Lapu-Lapu package. */
export const KEYCHAIN_FRAME = FRAMES.find((f) => f.layout === "keychain")!;

export function frameById(id: string): Frame | undefined {
  return FRAMES.find((f) => f.id === id);
}
