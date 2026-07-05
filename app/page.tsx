"use client";

// Single-route kiosk shell: the current "page" is client state, not a URL.
// Keying the wrapper by page re-triggers the shared view-in transition so
// Main → Selection → Capture → Main all read as one continuous piece of
// software.

import { useSession } from "@/lib/store";
import { MainPage } from "@/components/MainPage";
import { SelectionPage } from "@/components/SelectionPage";
import { CapturePage } from "@/components/CapturePage";

export default function Home() {
  const page = useSession((s) => s.page);

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
