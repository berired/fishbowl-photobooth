"use client";

// Page 3 — Capture. All internal states (start modal → burst ×6 → retake
// check → photo selection → final review → sending → done) render inside this
// one component; the <video> element stays mounted through burst + retakes so
// the camera permission is requested exactly once per session.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/store";
import { frameById } from "@/lib/frames";
import { buildComposite } from "@/lib/composite";
import { BURST_COUNT, COUNTDOWN_SECONDS, DONE_SECONDS, INTER_SHOT_MS } from "@/lib/config";

// ---- capture helper ---------------------------------------------------------

/** Grab the current video frame, mirrored to match the on-screen preview. */
function captureFrame(video: HTMLVideoElement | null): string | null {
  if (!video || video.videoWidth === 0) return null;
  const c = document.createElement("canvas");
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.translate(c.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0);
  return c.toDataURL("image/jpeg", 0.9);
}

// ---- shared bits --------------------------------------------------------------

function BigButton({
  children,
  onClick,
  disabled,
  variant = "gold",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "gold" | "quiet";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        variant === "gold"
          ? "rounded-full bg-gold px-10 py-4 text-xl font-bold text-foam shadow-lg shadow-gold/30 transition-transform active:scale-[0.97] disabled:opacity-40 disabled:shadow-none"
          : "rounded-full bg-foam px-10 py-4 text-xl font-bold text-water shadow-md shadow-water/10 transition-transform active:scale-[0.97]"
      }
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </button>
  );
}

function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <header className="text-center">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-kelp">{kicker}</p>
      <h2
        className="mt-1 text-[clamp(1.6rem,4.5vw,2.6rem)] font-bold text-water"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {title}
      </h2>
    </header>
  );
}

// ---- internal views -----------------------------------------------------------

function SessionStartModal({
  onStart,
  camError,
}: {
  onStart: () => void;
  camError: string | null;
}) {
  const requiredCount = useSession((s) => s.requiredCount);
  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-8 px-8">
      <div className="flex max-w-lg flex-col items-center gap-6 rounded-3xl bg-foam p-10 text-center shadow-xl shadow-water/15">
        <Heading kicker="Ready?" title="Here's how it works" />
        <ol className="space-y-3 text-left text-lg font-semibold text-water/85">
          <li>1. The camera takes {BURST_COUNT} photos, one at a time.</li>
          <li>2. Each photo has a {COUNTDOWN_SECONDS}-second countdown — strike a pose!</li>
          <li>3. Afterwards, pick your favorite {requiredCount === 1 ? "photo" : `${requiredCount} photos`} for your frame.</li>
        </ol>
        {camError ? (
          <div className="rounded-2xl bg-fin/30 p-4 text-base font-semibold text-water">
            <p>The camera isn&apos;t available: {camError}</p>
            <p className="mt-1">Allow camera access in the browser, then try again.</p>
          </div>
        ) : null}
        <BigButton onClick={onStart}>Start Picture</BigButton>
      </div>
    </div>
  );
}

function BurstCaptureView({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const burstPhotos = useSession((s) => s.burstPhotos);
  const addBurstPhoto = useSession((s) => s.addBurstPhoto);
  const finishBurst = useSession((s) => s.finishBurst);

  const [seconds, setSeconds] = useState(COUNTDOWN_SECONDS);
  const [flash, setFlash] = useState(false);
  // True only while a countdown is actively ticking — guards the capture
  // effect against stale `seconds === 0` renders between shots and against
  // dev-mode double-invoked effects.
  const armed = useRef(false);

  const shot = burstPhotos.length; // 0-based index of the attempt in progress

  // One effect per attempt: (re)arm the countdown. A short pause between shots
  // lets the flash + progress dot register before the next timer starts.
  useEffect(() => {
    if (shot >= BURST_COUNT) {
      finishBurst();
      return;
    }
    setSeconds(COUNTDOWN_SECONDS);
    let interval: ReturnType<typeof setInterval> | undefined;
    const kickoff = setTimeout(
      () => {
        armed.current = true;
        interval = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
      },
      shot === 0 ? 500 : INTER_SHOT_MS,
    );
    return () => {
      clearTimeout(kickoff);
      if (interval) clearInterval(interval);
    };
  }, [shot, finishBurst]);

  // Auto-capture at zero.
  useEffect(() => {
    if (seconds !== 0 || !armed.current) return;
    armed.current = false;
    const url = captureFrame(videoRef.current);
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 550);
    if (url) addBurstPhoto(url);
    return () => clearTimeout(t);
  }, [seconds, shot, addBurstPhoto, videoRef]);

  const counting = seconds > 0;

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-5 px-4 py-6">
      <Heading kicker="Smile!" title={`Photo ${Math.min(shot + 1, BURST_COUNT)} of ${BURST_COUNT}`} />

      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-water shadow-xl shadow-water/25">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="aspect-video w-full object-cover"
          style={{ transform: "scaleX(-1)" }}
        />

        {/* signature countdown bubble — swells each second, pops into the
            flash; tucked in the corner so it never covers the subject */}
        {counting ? (
          <div className="pointer-events-none absolute right-4 top-4">
            <div
              key={seconds}
              className="bubble-swell grid h-20 w-20 place-items-center rounded-full border-4 border-foam/80 bg-water/30 backdrop-blur-sm sm:h-28 sm:w-28"
              style={{ boxShadow: "inset -8px -8px 0 rgba(246,251,250,0.18)" }}
            >
              <span
                className="text-4xl font-extrabold text-foam sm:text-6xl"
                style={{ fontFamily: "var(--font-display)" }}
                aria-live="polite"
              >
                {seconds}
              </span>
            </div>
          </div>
        ) : null}

        {flash ? <div className="flash-pop pointer-events-none absolute inset-0 bg-foam" /> : null}
      </div>

      {/* progress bubbles */}
      <div className="flex gap-3" aria-label={`${shot} of ${BURST_COUNT} photos taken`}>
        {Array.from({ length: BURST_COUNT }).map((_, i) => (
          <span
            key={i}
            className={`block h-5 w-5 rounded-full border-[3px] transition-colors duration-300 ${
              i < shot ? "border-gold bg-gold" : "border-kelp/50 bg-transparent"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function RetakeCheckView() {
  const burstPhotos = useSession((s) => s.burstPhotos);
  const retakeAll = useSession((s) => s.retakeAll);
  const acceptBurst = useSession((s) => s.acceptBurst);

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-8 px-6 lg:flex-row lg:gap-14">
      {/* the 6 raw photos on one side… */}
      <div className="grid w-full max-w-2xl grid-cols-3 gap-3">
        {burstPhotos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={p}
            alt={`Photo ${i + 1}`}
            className="aspect-video w-full rounded-2xl border-4 border-foam object-cover shadow-md shadow-water/15"
          />
        ))}
      </div>

      {/* …Yes/No alongside them, both visible at once */}
      <div className="flex flex-col items-center gap-6">
        <Heading kicker="Look good?" title="Retake all 6?" />
        <div className="flex gap-4 lg:flex-col">
          <BigButton onClick={retakeAll} variant="quiet">
            Yes, retake
          </BigButton>
          <BigButton onClick={acceptBurst}>No, keep these</BigButton>
        </div>
      </div>
    </div>
  );
}

function SelectionView() {
  const burstPhotos = useSession((s) => s.burstPhotos);
  const selectedPhotoIds = useSession((s) => s.selectedPhotoIds);
  const requiredCount = useSession((s) => s.requiredCount);
  const togglePhoto = useSession((s) => s.togglePhoto);
  const confirmSelection = useSession((s) => s.confirmSelection);

  const remaining = requiredCount - selectedPhotoIds.length;

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-7 px-6">
      <Heading
        kicker="Your bubbles"
        title={
          remaining > 0
            ? `Pick ${remaining} more photo${remaining === 1 ? "" : "s"}`
            : "Perfect — ready to go!"
        }
      />

      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3">
        {burstPhotos.map((p, i) => {
          const id = String(i);
          const order = selectedPhotoIds.indexOf(id);
          const selected = order !== -1;
          return (
            <button
              key={id}
              type="button"
              onClick={() => togglePhoto(id)}
              aria-pressed={selected}
              className={`relative overflow-hidden rounded-2xl border-4 transition-all duration-200 active:scale-[0.97] ${
                selected
                  ? "scale-[1.02] border-gold shadow-lg shadow-gold/25"
                  : "border-foam shadow-md shadow-water/10"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`Photo ${i + 1}`} className="aspect-video w-full object-cover" />
              {selected ? (
                <span
                  className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-gold text-lg font-extrabold text-foam"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {order + 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <BigButton onClick={confirmSelection} disabled={remaining !== 0}>
        Continue
      </BigButton>
    </div>
  );
}

function FinalReviewView() {
  const burstPhotos = useSession((s) => s.burstPhotos);
  const selectedPhotoIds = useSession((s) => s.selectedPhotoIds);
  const frameId = useSession((s) => s.frameId);
  const sendError = useSession((s) => s.sendError);
  const startSending = useSession((s) => s.startSending);
  const sendFailed = useSession((s) => s.sendFailed);
  const sendSucceeded = useSession((s) => s.sendSucceeded);
  const backToPhotoSelection = useSession((s) => s.backToPhotoSelection);

  const [composite, setComposite] = useState<string | null>(null);
  const frame = frameId ? frameById(frameId) : undefined;

  useEffect(() => {
    if (!frame) return;
    let cancelled = false;
    const photos = selectedPhotoIds.map((id) => burstPhotos[Number(id)]);
    buildComposite(frame, photos).then((url) => {
      if (!cancelled) setComposite(url);
    });
    return () => {
      cancelled = true;
    };
  }, [frame, selectedPhotoIds, burstPhotos]);

  const send = useCallback(async () => {
    if (!composite) return;
    startSending();
    try {
      const res = await fetch("/api/canva/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: composite,
          title: `Fishbowl ${new Date().toLocaleString()}`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      sendSucceeded();
    } catch (e) {
      sendFailed(e instanceof Error ? e.message : String(e));
    }
  }, [composite, startSending, sendSucceeded, sendFailed]);

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-6 px-6">
      <Heading kicker="Final look" title="Here's your fishbowl!" />

      <div className="grid max-h-[58vh] place-items-center">
        {composite ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={composite}
            alt="Your finished photo frame"
            className="max-h-[58vh] w-auto rounded-2xl shadow-xl shadow-water/25"
          />
        ) : (
          <p className="pulse-soft text-lg font-bold text-kelp">Assembling your photos…</p>
        )}
      </div>

      {sendError ? (
        <div className="max-w-xl rounded-2xl bg-fin/30 px-5 py-3 text-center text-base font-semibold text-water">
          Sending didn&apos;t go through — tap &ldquo;Confirm &amp; Send&rdquo; to try again.
          <span className="mt-1 block text-sm font-normal opacity-70">{sendError}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-4">
        <BigButton onClick={backToPhotoSelection} variant="quiet">
          ← Change photos
        </BigButton>
        <BigButton onClick={send} disabled={!composite}>
          Confirm &amp; Send
        </BigButton>
      </div>
    </div>
  );
}

function SendingView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <div className="flex gap-3" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bob block h-8 w-8 rounded-full border-4 border-kelp/60"
            style={{ animationDelay: `${i * 0.25}s`, boxShadow: "inset -4px -4px 0 rgba(21,122,140,0.15)" }}
          />
        ))}
      </div>
      <p
        className="text-2xl font-bold text-water"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Sending your photos…
      </p>
    </div>
  );
}

function DoneView() {
  const resetSession = useSession((s) => s.resetSession);

  // Fixed, uninterruptible dwell — then the whole session resets for the next
  // customer. No tap-to-skip by design.
  useEffect(() => {
    const t = setTimeout(resetSession, DONE_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [resetSession]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="bob text-7xl" aria-hidden>
        🫧
      </div>
      <h2
        className="text-[clamp(2rem,6vw,3.5rem)] font-bold text-water"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Your photos are on their way
      </h2>
      <p className="text-lg font-semibold text-kelp">Thanks for visiting the fishbowl!</p>
    </div>
  );
}

// ---- page shell ----------------------------------------------------------------

export function CapturePage() {
  const status = useSession((s) => s.status);
  const beginBurst = useSession((s) => s.beginBurst);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startSession = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      beginBurst();
    } catch (e) {
      setCamError(e instanceof DOMException ? e.message : String(e));
    }
  }, [beginBurst]);

  // Attach the stream once the burst view (and its <video>) is mounted.
  useEffect(() => {
    if (status === "bursting" && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [status]);

  // Camera is only needed through burst + retakes; release it afterwards.
  useEffect(() => {
    if (status === "selecting-photos" || status === "done") stopCamera();
  }, [status, stopCamera]);
  useEffect(() => stopCamera, [stopCamera]);

  return (
    <div className="h-full w-full bg-pool text-water">
      {status === "idle" && <SessionStartModal onStart={startSession} camError={camError} />}
      {(status === "bursting" || status === "retake-check") && (
        <>
          {/* video stays mounted (hidden) during the retake check so a "Yes"
              restarts the burst without re-requesting the camera */}
          <div className={status === "bursting" ? "h-full" : "hidden"}>
            <BurstCaptureView videoRef={videoRef} />
          </div>
          {status === "retake-check" && <RetakeCheckView />}
        </>
      )}
      {status === "selecting-photos" && <SelectionView />}
      {status === "final-review" && <FinalReviewView />}
      {status === "sending" && <SendingView />}
      {status === "done" && <DoneView />}
    </div>
  );
}
