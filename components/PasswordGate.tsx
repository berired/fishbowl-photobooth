"use client";

// Shared-password screen in front of the whole kiosk app, so a customer who
// finds the domain can't get past the wallpaper. Password only — there are
// no staff accounts. Success sets a long-lived cookie (lib/auth.ts) and
// refreshes the server-rendered root layout, which then renders the kiosk.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RetroHeader } from "./retro";

export function PasswordGate() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (checking) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Wrong password — try again.");
        setPassword("");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="bg-bliss flex h-dvh w-full items-center justify-center overflow-hidden px-8">
      <form
        onSubmit={submit}
        className="panel95 flex w-[min(90vw,520px)] flex-col items-center gap-6 px-10 py-12"
      >
        <RetroHeader kicker="Staff Only" title="Enter Password" small />

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          className="text-pixel w-full border-2 border-ink bg-foam px-4 py-3 text-center text-[clamp(1rem,1.6vw,1.3rem)] text-ink outline-none focus-visible:outline-3 focus-visible:outline-gold"
        />

        {error ? (
          <p className="text-pixel text-center text-[clamp(0.85rem,1.1vw,1rem)] text-gold">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={checking || password.length === 0}
          className="btn95 btn95-primary w-full text-[clamp(1.1rem,1.9vw,1.6rem)]"
        >
          {checking ? "Checking…" : "Enter"}
        </button>
      </form>
    </main>
  );
}
