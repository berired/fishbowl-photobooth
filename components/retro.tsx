"use client";

// Shared retro-OS primitives, 1:1 with the Canva mockup (deck DAHOmmwPYhg):
// Sieben pixel-font kicker over a Lazydog bubble heading, and Win95 beveled buttons
// (gray secondary / blue primary). The shared Bliss wallpaper is painted once
// on the kiosk shell (app/page.tsx), not per screen.

export function RetroScreen({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full">{children}</div>;
}

export function RetroHeader({
  kicker,
  title,
  small,
}: {
  kicker: string;
  title: string;
  /** Slightly smaller title for dense screens (capture states). */
  small?: boolean;
}) {
  return (
    <header className="text-center">
      <p className="kicker-pixel text-[clamp(1.2rem,2.4vw,1.9rem)]">{kicker}</p>
      <h2
        className={`heading-bubble mt-2 ${
          small
            ? "text-[clamp(2.6rem,6.5vw,4.6rem)]"
            : "text-[clamp(3.2rem,8.5vw,6rem)]"
        }`}
      >
        {title}
      </h2>
    </header>
  );
}

export function Btn95({
  children,
  onClick,
  disabled,
  primary,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`btn95 ${primary ? "btn95-primary" : ""} text-[clamp(1.1rem,1.9vw,1.6rem)] ${className}`}
    >
      {children}
    </button>
  );
}
