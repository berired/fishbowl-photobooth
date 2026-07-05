// Frame catalog. Each frame is defined as a canvas composition (background +
// photo slots + foreground) so the on-screen preview and the final composite
// are drawn by the exact same code. When real PNG overlays exist later, only
// the draw functions here need to change — capture/compositing stay as-is.

export type BubbleType = "4-square" | "3-strip" | "1-keychain";

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
  bubbleType: BubbleType;
  width: number;
  height: number;
  slots: Slot[];
  /** Finished-design sample shown on the frame picker (public/ path). */
  sample?: string;
  drawBackground: (ctx: CanvasRenderingContext2D) => void;
  drawForeground?: (ctx: CanvasRenderingContext2D, displayFont: string) => void;
};

export const BUBBLE_TYPES: {
  id: BubbleType;
  label: string;
  sublabel: string;
  requiredCount: number;
}[] = [
  { id: "4-square", label: "4 Bubbles", sublabel: "Square", requiredCount: 4 },
  { id: "3-strip", label: "3 Bubbles", sublabel: "Vertical Half Strip", requiredCount: 3 },
  { id: "1-keychain", label: "1 Bubble", sublabel: "Keychain", requiredCount: 1 },
];

export function requiredCountFor(type: BubbleType): number {
  return BUBBLE_TYPES.find((b) => b.id === type)!.requiredCount;
}

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

/** Horizontal waterline wave across the full width at y. */
function wave(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  amp: number,
  color: string,
  fillDown: boolean,
  totalH: number,
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, y);
  const step = w / 6;
  for (let i = 0; i < 6; i++) {
    const x0 = i * step;
    ctx.quadraticCurveTo(x0 + step / 2, y + (i % 2 === 0 ? amp : -amp), x0 + step, y);
  }
  if (fillDown) {
    ctx.lineTo(w, totalH);
    ctx.lineTo(0, totalH);
  } else {
    ctx.lineTo(w, 0);
    ctx.lineTo(0, 0);
  }
  ctx.closePath();
  ctx.fill();
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

// ---- slot layouts per bubble type -------------------------------------------

// 4 Bubbles — Square: 1200×1200, 2×2 grid, footer band for the wordmark.
const SQ = { w: 1200, h: 1200, m: 64, gap: 36, footer: 168 };
const sqCell = (SQ.w - SQ.m * 2 - SQ.gap) / 2; // 518
const sqCellH = (SQ.h - SQ.m - SQ.footer - SQ.gap - 40) / 2; // grid ends 40px above footer
const squareSlots: Slot[] = [0, 1, 2, 3].map((i) => ({
  x: SQ.m + (i % 2) * (sqCell + SQ.gap),
  y: SQ.m + Math.floor(i / 2) * (sqCellH + SQ.gap),
  w: sqCell,
  h: sqCellH,
  r: 20,
}));

// 3 Bubbles — Vertical Half Strip: 600×1800, 3 stacked, footer band.
const ST = { w: 600, h: 1800, m: 46, gap: 32, footer: 196 };
const stCellH = (ST.h - ST.m - ST.footer - ST.gap * 2 - 36) / 3;
const stripSlots: Slot[] = [0, 1, 2].map((i) => ({
  x: ST.m,
  y: ST.m + i * (stCellH + ST.gap),
  w: ST.w - ST.m * 2,
  h: stCellH,
  r: 16,
}));

// 1 Bubble — Keychain: 900×900 tag with a circular photo window.
const KC = { w: 900, h: 900 };
const keychainSlots: Slot[] = [{ x: 170, y: 210, w: 560, h: 560, circle: true }];

// ---- the 7 frames -----------------------------------------------------------

export const FRAMES: Frame[] = [
  // ---- 4-square (3 designs) ----
  {
    id: "sq-sea-u-later",
    name: "Sea U Later",
    bubbleType: "4-square",
    width: SQ.w,
    height: SQ.h,
    slots: squareSlots,
    sample: "/assets/Samples/thumbs/4 Bubbles - Sea U Later.webp",
    drawBackground(ctx) {
      ctx.fillStyle = POOL;
      ctx.fillRect(0, 0, SQ.w, SQ.h);
      bubbles(ctx, SQ.w, SQ.h, FOAM, [
        [6, 8, 46], [94, 12, 30], [4, 60, 24], [96, 55, 40], [8, 92, 30], [90, 94, 50],
      ]);
      for (const s of squareSlots) {
        roundRect(ctx, s.x - 12, s.y - 12, s.w + 24, s.h + 24, (s.r ?? 0) + 10);
        ctx.fillStyle = FOAM;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, SQ.w / 2, SQ.h - SQ.footer / 2 - 8, 76, WATER, font);
      bubbles(ctx, SQ.w, SQ.h, GOLD, [[22, 89, 14], [78, 91, 18]]);
    },
  },
  {
    id: "sq-nemo",
    name: "Nemo",
    bubbleType: "4-square",
    width: SQ.w,
    height: SQ.h,
    slots: squareSlots,
    sample: "/assets/Samples/thumbs/4 Bubbles - Nemo.webp",
    drawBackground(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, SQ.h);
      g.addColorStop(0, "#12505F");
      g.addColorStop(1, WATER);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SQ.w, SQ.h);
      bubbles(ctx, SQ.w, SQ.h, POOL, [
        [8, 14, 38], [93, 8, 26], [5, 78, 28], [95, 70, 44], [50, 96, 20],
      ]);
      for (const s of squareSlots) {
        roundRect(ctx, s.x - 12, s.y - 12, s.w + 24, s.h + 24, (s.r ?? 0) + 10);
        ctx.fillStyle = FOAM;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, SQ.w / 2, SQ.h - SQ.footer / 2 - 8, 76, FOAM, font);
    },
  },
  {
    id: "sq-fih",
    name: "Fih.",
    bubbleType: "4-square",
    width: SQ.w,
    height: SQ.h,
    slots: squareSlots,
    sample: "/assets/Samples/thumbs/4 Bubbles - Fih..webp",
    drawBackground(ctx) {
      ctx.fillStyle = FOAM;
      ctx.fillRect(0, 0, SQ.w, SQ.h);
      wave(ctx, SQ.w, SQ.h - SQ.footer - 10, 18, FIN, true, SQ.h);
      wave(ctx, SQ.w, SQ.h - SQ.footer + 26, 14, GOLD, true, SQ.h);
      for (const s of squareSlots) {
        roundRect(ctx, s.x - 12, s.y - 12, s.w + 24, s.h + 24, (s.r ?? 0) + 10);
        ctx.fillStyle = POOL;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, SQ.w / 2, SQ.h - SQ.footer / 2 + 10, 72, FOAM, font);
    },
  },

  // ---- 3-strip (3 designs) ----
  {
    id: "st-fih",
    name: "Fih.",
    bubbleType: "3-strip",
    width: ST.w,
    height: ST.h,
    slots: stripSlots,
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
    bubbleType: "3-strip",
    width: ST.w,
    height: ST.h,
    slots: stripSlots,
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
      for (const s of stripSlots) {
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
    bubbleType: "3-strip",
    width: ST.w,
    height: ST.h,
    slots: stripSlots,
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
      for (const s of stripSlots) {
        roundRect(ctx, s.x - 10, s.y - 10, s.w + 20, s.h + 20, (s.r ?? 0) + 8);
        ctx.fillStyle = FOAM;
        ctx.fill();
      }
    },
    drawForeground(ctx, font) {
      wordmark(ctx, ST.w / 2, ST.h - ST.footer / 2 - 6, 60, FOAM, font);
    },
  },

  // ---- 1-keychain (1 design) ----
  {
    id: "kc-bubble",
    name: "Bubble Tag",
    bubbleType: "1-keychain",
    width: KC.w,
    height: KC.h,
    slots: keychainSlots,
    sample: "/assets/Samples/thumbs/Keychain Sample.webp",
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

export function framesFor(type: BubbleType): Frame[] {
  return FRAMES.filter((f) => f.bubbleType === type);
}

export function frameById(id: string): Frame | undefined {
  return FRAMES.find((f) => f.id === id);
}
