"use client";

// Canvas-backed frame preview. Renders with the exact same code path as the
// final composite, so what the customer picks is what they get.

import { useEffect, useRef } from "react";
import { renderFrame } from "@/lib/composite";
import type { Frame } from "@/lib/frames";

export function FramePreview({
  frame,
  photos = null,
  className,
}: {
  frame: Frame;
  photos?: string[] | null;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let cancelled = false;
    renderFrame(canvas, frame, photos).catch((e) => {
      if (!cancelled) console.error("Frame preview failed:", e);
    });
    return () => {
      cancelled = true;
    };
  }, [frame, photos]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
      aria-label={`${frame.name} frame preview`}
    />
  );
}
