import type { Metadata } from "next";
import { Sora, Work_Sans } from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  weight: ["600", "700", "800"],
  subsets: ["latin"],
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

/**
 * Links to these pages get shared in WhatsApp groups more than anywhere else,
 * so the preview card matters. `metadataBase` has to be absolute for the image
 * to resolve; without NEXT_PUBLIC_SITE_URL, Next falls back to a relative URL
 * and the preview shows no artwork.
 */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  title: {
    default: "LoveGate · Love Inc events",
    template: "%s · LoveGate",
  },
  description:
    "Free tickets to Love Inc gatherings. Register in about a minute and show the QR code at the door.",
  openGraph: {
    type: "website",
    siteName: "LoveGate",
    title: "LoveGate · Love Inc events",
    description:
      "Free tickets to Love Inc gatherings. Register in about a minute and show the QR code at the door.",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sora.variable} ${workSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
