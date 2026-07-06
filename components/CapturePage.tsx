"use client";

// Page 3 — Capture. All internal states (start modal → burst ×6 → retake
// check → photo selection → [keychain pick, Lapu-Lapu only] → final review →
// sending → done) render inside this one component; the <video> element stays
// mounted through burst + retakes so the camera permission is requested
// exactly once per session. Visuals are 1:1 with mockup pages 5–8.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/store";
import { frameById, KEYCHAIN_FRAME } from "@/lib/frames";
import { buildComposite } from "@/lib/composite";
import { BURST_COUNT, COUNTDOWN_SECONDS, DONE_SECONDS, INTER_SHOT_MS } from "@/lib/config";
import { RetroScreen, RetroHeader, Btn95 } from "./retro";

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
      <div className="panel95 flex max-w-3xl flex-col items-center gap-8 p-12 text-center">
        <RetroHeader small kicker="Ready?" title="Here's how it works" />
        <ol className="text-pixel space-y-5 text-left text-[clamp(1rem,1.4vw,1.3rem)] leading-relaxed text-ink">
          <li>1. The camera takes {BURST_COUNT} photos, one at a time.</li>
          <li>2. Each photo has a {COUNTDOWN_SECONDS}-second countdown — strike a pose!</li>
          <li>3. Afterwards, pick your favorite {requiredCount === 1 ? "photo" : `${requiredCount} photos`} for your frame.</li>
        </ol>
        {camError ? (
          <div className="text-pixel border-2 border-ink bg-fin/60 p-5 text-[clamp(0.9rem,1.2vw,1.1rem)] text-ink">
            <p>The camera isn&apos;t available: {camError}</p>
            <p className="mt-2">Allow camera access in the browser, then try again.</p>
          </div>
        ) : null}
        <Btn95 onClick={onStart} primary>
          Start Picture
        </Btn95>
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
      <RetroHeader
        small
        kicker="Smile!"
        title={`Photo ${Math.min(shot + 1, BURST_COUNT)} of ${BURST_COUNT}`}
      />

      {/* black camera panel with a beveled frame, countdown pinned top-right */}
      <div className="panel95 relative w-full max-w-5xl p-3">
        <div className="relative overflow-hidden bg-ink">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-video w-full object-cover"
            style={{ transform: "scaleX(-1)" }}
          />

          {counting ? (
            <div className="pointer-events-none absolute right-5 top-5">
              <div
                key={seconds}
                className="bubble-swell grid h-24 w-24 place-items-center rounded-full border-4 border-butter bg-ink/40 sm:h-32 sm:w-32"
              >
                <span className="text-pixel text-4xl text-butter sm:text-6xl" aria-live="polite">
                  {seconds}
                </span>
              </div>
            </div>
          ) : null}

          {flash ? <div className="flash-pop pointer-events-none absolute inset-0 bg-foam" /> : null}
        </div>
      </div>

      {/* progress bubbles */}
      <div className="flex gap-4" aria-label={`${shot} of ${BURST_COUNT} photos taken`}>
        {Array.from({ length: BURST_COUNT }).map((_, i) => (
          <span
            key={i}
            className={`block h-6 w-6 rounded-full border-[3px] transition-colors duration-300 ${
              i < shot ? "border-butter bg-butter" : "border-white/80 bg-transparent"
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
    <div className="step-in flex h-full flex-col items-center justify-center gap-7 px-6">
      <RetroHeader kicker="Look good?" title={`Retake all ${BURST_COUNT}?`} />

      <div className="grid w-full max-w-5xl grid-cols-3 gap-5">
        {burstPhotos.map((p, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={p}
            alt={`Photo ${i + 1}`}
            className="aspect-video w-full border-2 border-ink object-cover shadow-[4px_4px_0_rgba(17,17,17,0.4)]"
          />
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-6">
        <Btn95 onClick={retakeAll}>Yes, retake</Btn95>
        <Btn95 onClick={acceptBurst} primary>
          No, keep these
        </Btn95>
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
      <RetroHeader
        kicker="Your bubbles"
        title={
          remaining > 0
            ? `Pick ${remaining} more photo${remaining === 1 ? "" : "s"}`
            : "Perfect - ready to go!"
        }
      />

      <div className="grid w-full max-w-5xl grid-cols-2 gap-5 sm:grid-cols-3">
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
              className={`relative overflow-hidden border-4 transition-all duration-200 active:scale-[0.97] ${
                selected
                  ? "scale-[1.02] border-butter shadow-[4px_4px_0_rgba(17,17,17,0.5)]"
                  : "border-ink shadow-[4px_4px_0_rgba(17,17,17,0.35)]"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt={`Photo ${i + 1}`} className="aspect-video w-full object-cover" />
              {selected ? (
                <span className="text-pixel absolute right-3 top-3 grid h-14 w-14 place-items-center rounded-full border-[3px] border-navy bg-butter text-2xl text-navy">
                  {order + 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <Btn95 onClick={confirmSelection} disabled={remaining !== 0}>
        Continue
      </Btn95>
    </div>
  );
}

// Lapu-Lapu only — one of the strip photos also goes on the bubble keychain.
function KeychainPickView() {
  const burstPhotos = useSession((s) => s.burstPhotos);
  const selectedPhotoIds = useSession((s) => s.selectedPhotoIds);
  const chooseKeychainPhoto = useSession((s) => s.chooseKeychainPhoto);
  const backToPhotoSelection = useSession((s) => s.backToPhotoSelection);

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-7 px-6">
      <RetroHeader kicker="One more!" title="Pick 1 photo for your keychain" />

      <div className="flex w-full max-w-5xl flex-wrap justify-center gap-6">
        {selectedPhotoIds.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => chooseKeychainPhoto(id)}
            className="w-[calc(50%-0.5rem)] overflow-hidden border-4 border-ink shadow-[4px_4px_0_rgba(17,17,17,0.35)] transition-all duration-200 hover:scale-[1.02] hover:border-butter active:scale-[0.97] sm:w-[calc(33.333%-0.7rem)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={burstPhotos[Number(id)]}
              alt={`Photo ${Number(id) + 1}`}
              className="aspect-video w-full object-cover"
            />
          </button>
        ))}
      </div>

      <Btn95 onClick={backToPhotoSelection}>← Change photos</Btn95>
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

  const keychainPhotoId = useSession((s) => s.keychainPhotoId);
  const needsKeychain = useSession((s) => s.needsKeychain);

  const [composite, setComposite] = useState<string | null>(null);
  const [keychainComposite, setKeychainComposite] = useState<string | null>(null);
  const frame = frameId ? frameById(frameId) : undefined;

  useEffect(() => {
    if (!frame) return;
    let cancelled = false;
    const photos = selectedPhotoIds.map((id) => burstPhotos[Number(id)]);
    buildComposite(frame, photos).then((url) => {
      if (!cancelled) setComposite(url);
    });
    if (needsKeychain && keychainPhotoId !== null) {
      buildComposite(KEYCHAIN_FRAME, [burstPhotos[Number(keychainPhotoId)]]).then((url) => {
        if (!cancelled) setKeychainComposite(url);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [frame, selectedPhotoIds, burstPhotos, needsKeychain, keychainPhotoId]);

  const ready = composite !== null && (!needsKeychain || keychainComposite !== null);

  const send = useCallback(async () => {
    if (!ready) return;
    startSending();
    const stamp = new Date().toLocaleString();
    const uploads: { image: string; title: string }[] = [
      { image: composite!, title: `Fishbowl ${stamp} — Strip` },
    ];
    if (needsKeychain && keychainComposite) {
      uploads.push({ image: keychainComposite, title: `Fishbowl ${stamp} — Keychain` });
    }
    try {
      for (const body of uploads) {
        const res = await fetch("/api/canva/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
      }
      sendSucceeded();
    } catch (e) {
      sendFailed(e instanceof Error ? e.message : String(e));
    }
  }, [ready, composite, keychainComposite, needsKeychain, startSending, sendSucceeded, sendFailed]);

  return (
    <div className="step-in flex h-full flex-col items-center justify-center gap-6 px-6">
      <RetroHeader kicker="Final look" title="Here's your bubbles!" />

      <div className="flex max-h-[56vh] items-center justify-center gap-6">
        {ready ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={composite!}
              alt="Your finished photo strip"
              className="max-h-[56vh] w-auto shadow-[6px_6px_0_rgba(17,17,17,0.4)]"
            />
            {keychainComposite ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={keychainComposite}
                alt="Your keychain"
                className="max-h-[26vh] w-auto shadow-[6px_6px_0_rgba(17,17,17,0.4)]"
              />
            ) : null}
          </>
        ) : (
          <p className="kicker-pixel pulse-soft text-2xl">Assembling your photos…</p>
        )}
      </div>

      {sendError ? (
        <div className="text-pixel max-w-2xl border-2 border-ink bg-fin/70 px-6 py-4 text-center text-[clamp(0.9rem,1.2vw,1.1rem)] text-ink">
          Sending didn&apos;t go through — tap &ldquo;Confirm &amp; Send&rdquo; to try again.
          <span className="mt-2 block normal-case tracking-normal opacity-70">{sendError}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-6">
        <Btn95 onClick={backToPhotoSelection}>Change photos</Btn95>
        <Btn95 onClick={send} disabled={!ready} primary>
          Confirm &amp; Send
        </Btn95>
      </div>
    </div>
  );
}

function SendingView() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8">
      <div className="flex gap-5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="bob block h-14 w-14 rounded-full border-[5px] border-butter"
            style={{ animationDelay: `${i * 0.25}s` }}
          />
        ))}
      </div>
      <p className="heading-bubble text-[clamp(2.2rem,5vw,3.6rem)]">Sending your photos…</p>
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
    <div className="flex h-full flex-col items-center justify-center gap-8 px-8 text-center">
      {/* brand bubbles instead of an emoji icon — consistent with the countdown */}
      <div className="bob flex items-end gap-4" aria-hidden>
        <span className="block h-10 w-10 rounded-full border-4 border-butter" />
        <span className="block h-16 w-16 rounded-full border-[5px] border-butter" />
        <span className="block h-8 w-8 rounded-full border-4 border-butter" />
      </div>
      <h2 className="heading-bubble text-[clamp(2.6rem,7vw,5rem)]">
        Your photos are on their way
      </h2>
      <p className="kicker-pixel text-[clamp(1.2rem,1.8vw,1.7rem)]">
        Thanks for visiting the fishbowl!
      </p>
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
    <RetroScreen>
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
      {status === "selecting-keychain-photo" && <KeychainPickView />}
      {status === "final-review" && <FinalReviewView />}
      {status === "sending" && <SendingView />}
      {status === "done" && <DoneView />}
    </RetroScreen>
  );
}
