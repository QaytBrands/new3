import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Wortweg — German vocabulary", template: "%s · Wortweg" },
  description: "Learn German vocabulary day by day.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#3b54d6" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
