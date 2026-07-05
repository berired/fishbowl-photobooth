"use client";

// Page 2 — Selection: Step A picks the bubble type (sets requiredCount),
// Step B picks a frame design filtered to that type. Both steps live on this
// page; the step swap is an in-place slide, not a navigation.

import { useSession } from "@/lib/store";
import { BUBBLE_TYPES, framesFor, type BubbleType } from "@/lib/frames";
import { FramePreview } from "./FramePreview";

function BubbleTypeStep() {
  const chooseBubbleType = useSession((s) => s.chooseBubbleType);

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-10 px-6">
      <header className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-kelp">Step 1 of 2</p>
        <h2
          className="mt-2 text-[clamp(2rem,6vw,3.5rem)] font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Pick your bubbles
        </h2>
      </header>

      <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-3">
        {BUBBLE_TYPES.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => chooseBubbleType(b.id as BubbleType)}
            className="group flex flex-col items-center gap-4 rounded-3xl bg-foam p-8 shadow-md shadow-water/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
          >
            {/* bubble cluster sized to the count */}
            <div className="flex h-24 items-center justify-center gap-2">
              {Array.from({ length: b.requiredCount }).map((_, i) => (
                <span
                  key={i}
                  className="block rounded-full border-4 border-kelp/60 transition-colors group-hover:border-gold"
                  style={{
                    width: 64 - b.requiredCount * 8,
                    height: 64 - b.requiredCount * 8,
                    boxShadow: "inset -5px -5px 0 rgba(21,122,140,0.15)",
                  }}
                />
              ))}
            </div>
            <div className="text-center">
              <div
                className="text-2xl font-bold"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {b.label}
              </div>
              <div className="mt-1 text-sm font-semibold text-kelp">{b.sublabel}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function FrameDesignStep() {
  const bubbleType = useSession((s) => s.bubbleType);
  const chooseFrame = useSession((s) => s.chooseFrame);
  const backToBubbleType = useSession((s) => s.backToBubbleType);
  if (!bubbleType) return null;

  const frames = framesFor(bubbleType);
  const label = BUBBLE_TYPES.find((b) => b.id === bubbleType)!.label;

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-8 px-6">
      <header className="text-center">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-kelp">
          Step 2 of 2 · {label}
        </p>
        <h2
          className="mt-2 text-[clamp(2rem,6vw,3.5rem)] font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Pick a frame
        </h2>
      </header>

      <div className="flex w-full max-w-4xl flex-wrap items-end justify-center gap-6">
        {frames.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => chooseFrame(f.id)}
            className="group flex flex-col items-center gap-3 rounded-3xl bg-foam p-4 shadow-md shadow-water/10 transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
          >
            {f.sample ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.sample}
                alt={`${f.name} frame sample`}
                className="max-h-[46vh] w-auto max-w-[38vw] rounded-xl object-contain sm:max-w-[240px]"
              />
            ) : (
              <FramePreview
                frame={f}
                className="max-h-[46vh] w-auto max-w-[38vw] rounded-xl sm:max-w-[240px]"
              />
            )}
            <span
              className="text-lg font-bold group-hover:text-gold"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {f.name}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={backToBubbleType}
        className="rounded-full px-6 py-3 text-base font-bold text-kelp underline-offset-4 hover:underline"
      >
        ← Change bubbles
      </button>
    </div>
  );
}

export function SelectionPage() {
  const status = useSession((s) => s.status);
  return (
    <div className="h-full w-full bg-pool text-water">
      {status === "selecting-bubble" ? <BubbleTypeStep /> : <FrameDesignStep />}
    </div>
  );
}
