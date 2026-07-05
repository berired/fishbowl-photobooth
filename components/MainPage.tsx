"use client";

// Page 1 — attract screen. Tap anywhere to start. Ambient rising bubbles are
// the idle animation placeholder (same bubble language as the countdown).

import { useSession } from "@/lib/store";

const AMBIENT_BUBBLES = [
  { left: "8%", size: 56, dur: "13s", delay: "0s", drift: "18px" },
  { left: "18%", size: 24, dur: "9s", delay: "2.5s", drift: "-12px" },
  { left: "31%", size: 40, dur: "15s", delay: "5s", drift: "10px" },
  { left: "47%", size: 18, dur: "8s", delay: "1s", drift: "-16px" },
  { left: "58%", size: 64, dur: "17s", delay: "6.5s", drift: "22px" },
  { left: "71%", size: 30, dur: "11s", delay: "3.5s", drift: "-10px" },
  { left: "84%", size: 46, dur: "14s", delay: "0.8s", drift: "14px" },
  { left: "93%", size: 20, dur: "10s", delay: "4.2s", drift: "-14px" },
];

export function MainPage() {
  const tapStart = useSession((s) => s.tapStart);

  return (
    <button
      type="button"
      onClick={tapStart}
      className="relative h-full w-full cursor-pointer overflow-hidden bg-pool text-water"
      aria-label="Tap to start a photo session"
    >
      {/* ambient bubbles */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {AMBIENT_BUBBLES.map((b, i) => (
          <span
            key={i}
            className="bubble-rise absolute top-0 block rounded-full border-[3px] border-foam/70"
            style={{
              left: b.left,
              width: b.size,
              height: b.size,
              ["--dur" as string]: b.dur,
              ["--delay" as string]: b.delay,
              ["--drift" as string]: b.drift,
              boxShadow: "inset -6px -6px 0 rgba(246,251,250,0.25)",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 px-8">
        <div className="bob">
          <h1
            className="text-[clamp(4rem,16vw,11rem)] font-extrabold leading-none tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            fishbowl
          </h1>
          <p className="mt-1 text-center text-lg font-semibold uppercase tracking-[0.35em] text-kelp">
            photobooth
          </p>
        </div>

        <div className="pulse-soft mt-14 rounded-full bg-gold px-12 py-5 text-2xl font-bold text-foam shadow-lg shadow-gold/30">
          Tap to start
        </div>
      </div>
    </button>
  );
}
