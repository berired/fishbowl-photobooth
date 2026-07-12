import type { Metadata, Viewport } from "next";
import { Baloo_2, Nunito_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { AUTH_COOKIE, validToken } from "@/lib/auth";
import { PasswordGate } from "@/components/PasswordGate";
import "./globals.css";

const display = Baloo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const body = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Fishbowl",
  description: "Fishbowl photobooth kiosk",
  icons: { icon: "/assets/Fishbowl Studios Favicon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const authed = jar.get(AUTH_COOKIE)?.value === validToken();

  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {authed ? children : <PasswordGate />}
      </body>
    </html>
  );
}
