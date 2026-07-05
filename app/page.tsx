"use client";

// Single-route kiosk shell: the current "page" is client state, not a URL.
// Keying the wrapper by page re-triggers the shared view-in transition so
// Main → Selection → Capture → Main all read as one continuous piece of
// software.

import { useEffect } from "react";
import { useSession } from "@/lib/store";
import { FRAMES } from "@/lib/frames";
import { MainPage } from "@/components/MainPage";
import { SelectionPage } from "@/components/SelectionPage";
import { CapturePage } from "@/components/CapturePage";

export default function Home() {
  const page = useSession((s) => s.page);

  // Warm the frame-sample images while the attract screen idles, so the
  // frame picker renders instantly for every customer.
  useEffect(() => {
    for (const f of FRAMES) {
      if (f.sample) new Image().src = f.sample;
    }
  }, []);

  return (
    <main className="h-dvh w-full overflow-hidden bg-pool">
      <div key={page} className="view-in h-full w-full">
        {page === "main" && <MainPage />}
        {page === "selection" && <SelectionPage />}
        {page === "capture" && <CapturePage />}
      </div>
    </main>
  );
}
