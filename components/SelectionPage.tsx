"use client";

// Page 2 — Selection, 1:1 with mockup pages 2–4:
//   Step 1 of 3 — PICK YOUR PACKAGE (bangus / tilapia / lapu-lapu cards)
//   Step 2 of 3 — PICK YOUR BUBBLES (4 bubbles = full strip, 3 = half strip)
//   Step 3 of 3 — PICK YOUR FRAME (sea u later / nemo / fih.)
// All steps live on this page; the step swap is an in-place slide.

import { useSession } from "@/lib/store";
import {
  PACKAGES,
  packageById,
  framesFor,
  KEYCHAIN_SAMPLE,
  type PackageId,
  type StripType,
} from "@/lib/frames";
import { FramePreview } from "./FramePreview";
import { RetroScreen, RetroHeader } from "./retro";

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-pixel px-8 py-4 text-[clamp(1rem,1.6vw,1.35rem)] text-white [text-shadow:2px_2px_0_#111] underline-offset-8 hover:underline"
    >
      {children}
    </button>
  );
}

function PackageStep() {
  const choosePackage = useSession((s) => s.choosePackage);

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-10 px-6">
      <RetroHeader kicker="Step 1 of 3" title="Pick your package" />

      <div className="grid w-full max-w-7xl gap-10 sm:grid-cols-3">
        {PACKAGES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => choosePackage(p.id)}
            className="panel95 flex flex-col items-center gap-5 p-6"
          >
            <div className="text-pixel text-[clamp(0.85rem,1.15vw,1.1rem)] text-ink">
              {p.tagline}
            </div>
            {/* finished-design samples of what the package includes */}
            <div className="flex h-[38vh] items-center justify-center gap-4">
              {p.samples.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="max-h-[38vh] min-w-0 flex-shrink object-contain shadow-md shadow-ink/30"
                />
              ))}
            </div>
            <div className="text-pixel text-[clamp(1.2rem,1.7vw,1.7rem)] text-ink">{p.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// The bubbles diagram on the step-2 cards: 4 = 2×2 grid, 3 = one over two.
function BubbleDiagram({ count }: { count: 3 | 4 }) {
  const bubble = <span className="bubble-diagram block h-24 w-24 sm:h-32 sm:w-32" />;
  return count === 4 ? (
    <div className="grid grid-cols-2 gap-5">
      {bubble}
      {bubble}
      {bubble}
      {bubble}
    </div>
  ) : (
    <div className="flex flex-col items-center gap-5">
      {bubble}
      <div className="flex gap-5">
        {bubble}
        {bubble}
      </div>
    </div>
  );
}

function BubblesStep() {
  const packageId = useSession((s) => s.packageId);
  const chooseVariant = useSession((s) => s.chooseVariant);
  const backToPackage = useSession((s) => s.backToPackage);
  if (!packageId) return null;

  const pkg = packageById(packageId as PackageId);
  const pick = (stripType: StripType) => {
    const variant = pkg.variants.find((v) => v.stripType === stripType)!;
    chooseVariant(variant.id);
  };

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-10 px-6">
      <RetroHeader kicker="Step 2 of 3" title="Pick your bubbles" />

      <div className="grid w-full max-w-4xl gap-10 sm:grid-cols-2">
        {([4, 3] as const).map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => pick(count === 4 ? "full" : "half")}
            className="panel95 flex aspect-square flex-col items-center justify-center gap-8 p-8"
          >
            <BubbleDiagram count={count} />
            <div className="text-pixel text-[clamp(1.2rem,1.7vw,1.7rem)] text-ink">
              {count} bubbles
            </div>
          </button>
        ))}
      </div>

      {pkg.keychain ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={KEYCHAIN_SAMPLE}
          alt="Includes a bubble keychain"
          className="h-28 object-contain drop-shadow-[3px_3px_0_rgba(17,17,17,0.4)]"
        />
      ) : null}

      <BackLink onClick={backToPackage}>← Change package</BackLink>
    </div>
  );
}

function FrameDesignStep() {
  const packageId = useSession((s) => s.packageId);
  const variantId = useSession((s) => s.variantId);
  const chooseFrame = useSession((s) => s.chooseFrame);
  const backToVariant = useSession((s) => s.backToVariant);
  if (!packageId || !variantId) return null;

  const pkg = packageById(packageId as PackageId);
  const variant = pkg.variants.find((v) => v.id === variantId)!;
  const frames = framesFor(variant.stripType);

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-8 px-6">
      <RetroHeader kicker="Step 3 of 3" title="Pick your frame" />

      <div className="flex w-full max-w-7xl flex-wrap items-stretch justify-center gap-10">
        {frames.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => chooseFrame(f.id)}
            className="panel95 flex flex-col items-center justify-between gap-4 p-6"
          >
            {f.sample ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.sample}
                alt={`${f.name} frame sample`}
                className="max-h-[50vh] w-auto max-w-[36vw] object-contain shadow-md shadow-ink/30 sm:max-w-[280px]"
              />
            ) : (
              <FramePreview
                frame={f}
                className="max-h-[50vh] w-auto max-w-[36vw] sm:max-w-[280px]"
              />
            )}
            <span className="text-pixel text-[clamp(1.1rem,1.5vw,1.5rem)] text-ink">{f.name}</span>
          </button>
        ))}
      </div>

      <BackLink onClick={backToVariant}>← Change bubbles</BackLink>
    </div>
  );
}

export function SelectionPage() {
  const status = useSession((s) => s.status);
  return (
    <RetroScreen>
      {status === "selecting-package" && <PackageStep />}
      {status === "selecting-variant" && <BubblesStep />}
      {status === "selecting-frame" && <FrameDesignStep />}
    </RetroScreen>
  );
}
