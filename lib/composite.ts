// Client-side compositing: draws the selected photos into the chosen frame's
// slots on an offscreen canvas and returns a JPEG data URL. The same renderer
// powers frame previews (with placeholder fills) so previews are WYSIWYG.

import type { Frame, Slot } from "./frames";

/** Resolve the display font family injected by next/font for canvas use. */
function displayFontFamily(): string {
  if (typeof document === "undefined") return "sans-serif";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-display")
    .trim();
  return v || "sans-serif";
}

function clipSlot(ctx: CanvasRenderingContext2D, s: Slot) {
  ctx.beginPath();
  if (s.circle) {
    // ellipse, so hand-drawn (non-round) circle windows are filled edge to edge
    ctx.ellipse(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, s.h / 2, 0, 0, Math.PI * 2);
  } else {
    const r = s.r ?? 0;
    ctx.moveTo(s.x + r, s.y);
    ctx.arcTo(s.x + s.w, s.y, s.x + s.w, s.y + s.h, r);
    ctx.arcTo(s.x + s.w, s.y + s.h, s.x, s.y + s.h, r);
    ctx.arcTo(s.x, s.y + s.h, s.x, s.y, r);
    ctx.arcTo(s.x, s.y, s.x + s.w, s.y, r);
  }
  ctx.closePath();
}

/** Draw an image into a slot with cover-fit cropping. */
function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s: Slot) {
  const iw = (img as HTMLImageElement).naturalWidth ?? (img as HTMLVideoElement).videoWidth;
  const ih = (img as HTMLImageElement).naturalHeight ?? (img as HTMLVideoElement).videoHeight;
  const scale = Math.max(s.w / iw, s.h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.save();
  clipSlot(ctx, s);
  ctx.clip();
  ctx.drawImage(img, s.x + (s.w - dw) / 2, s.y + (s.h - dh) / 2, dw, dh);
  ctx.restore();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function ensureDisplayFontLoaded(font: string) {
  try {
    await document.fonts.load(`700 76px ${font}`);
    await document.fonts.load(`600 24px ${font}`);
  } catch {
    // canvas falls back to a default face; composition still succeeds
  }
}

/**
 * Render a frame onto `canvas`. When `photos` is null, slots are filled with a
 * placeholder water gradient (used for frame previews on the selection page).
 */
export async function renderFrame(
  canvas: HTMLCanvasElement,
  frame: Frame,
  photos: string[] | null,
) {
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // Real frame artwork: draw it full-bleed, photos go into the slots on top.
  if (frame.overlay) {
    const art = await loadImage(frame.overlay);
    ctx.drawImage(art, 0, 0, frame.width, frame.height);
    if (photos) {
      const imgs = await Promise.all(photos.map(loadImage));
      frame.slots.forEach((s, i) => {
        if (imgs[i]) drawCover(ctx, imgs[i], s);
      });
    }
    return;
  }

  const font = displayFontFamily();
  await ensureDisplayFontLoaded(font);

  frame.drawBackground(ctx);

  if (photos) {
    const imgs = await Promise.all(photos.map(loadImage));
    frame.slots.forEach((s, i) => {
      if (imgs[i]) drawCover(ctx, imgs[i], s);
    });
  } else {
    for (const s of frame.slots) {
      ctx.save();
      clipSlot(ctx, s);
      ctx.clip();
      const g = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
      g.addColorStop(0, "#8FD0CC");
      g.addColorStop(1, "#4D9AA6");
      ctx.fillStyle = g;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      // placeholder bubble trio so empty slots still read as "photo goes here"
      ctx.strokeStyle = "rgba(246,251,250,0.7)";
      const r = Math.min(s.w, s.h);
      ctx.lineWidth = r * 0.015;
      for (const [fx, fy, fr] of [
        [0.5, 0.55, 0.16],
        [0.36, 0.34, 0.07],
        [0.63, 0.3, 0.05],
      ] as const) {
        ctx.beginPath();
        ctx.arc(s.x + s.w * fx, s.y + s.h * fy, r * fr, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  frame.drawForeground?.(ctx, font);
}

/** Build the final composited JPEG for upload. */
export async function buildComposite(frame: Frame, photos: string[]): Promise<string> {
  const canvas = document.createElement("canvas");
  await renderFrame(canvas, frame, photos);
  return canvas.toDataURL("image/jpeg", 0.92);
}
