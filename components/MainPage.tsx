"use client";

// Page 1 — attract screen, 1:1 with mockup page 1: Bliss wallpaper, the big
// Fishbowl Studio logo in the upper half, a Win95 START button below. The
// whole screen is tappable. A small Logout tucks into the top-right corner —
// staff-only, clears the shared password cookie (lib/auth.ts).

import { useRouter } from "next/navigation";
import { useSession } from "@/lib/store";

export function MainPage() {
  const router = useRouter();
  const tapStart = useSession((s) => s.tapStart);
  const resetSession = useSession((s) => s.resetSession);

  async function logout(e: React.MouseEvent) {
    e.stopPropagation();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    resetSession();
    router.refresh();
  }

  return (
    // A tappable div, not <button>, so the Logout button can nest inside it.
    <div
      role="button"
      tabIndex={0}
      onClick={tapStart}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && tapStart()}
      className="relative h-full w-full cursor-pointer overflow-hidden"
      aria-label="Tap to start a photo session"
    >
      <button
        type="button"
        onClick={logout}
        className="btn95 absolute top-4 right-4 z-10 px-4 py-2 text-[clamp(0.7rem,1vw,0.9rem)]"
      >
        Logout
      </button>

      <div className="flex h-full flex-col items-center justify-center gap-8 px-8">
        {/* trimmed copy of assets/Fishbowl Main Logo.png (the original is an
            8534px square with the mark floating in transparent padding) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/ui/logo-main.png"
          alt="Fishbowl Studio"
          className="bob w-[min(72vw,1250px)] object-contain drop-shadow-[0_10px_0_rgba(17,17,17,0.25)]"
        />

        <span className="btn95 pulse-soft w-[min(46vw,560px)] px-16 py-7 text-center text-[clamp(1.6rem,2.8vw,2.4rem)]">
          Start
        </span>
      </div>
    </div>
  );
}
