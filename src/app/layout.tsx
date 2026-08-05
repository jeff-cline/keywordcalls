import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KeywordCalls — High-intent calls, delivered live 🚀",
  description: "Pick your keyword, set your bid, and get high-intent targeted phone calls delivered to your line in real time. Powered by PredictiveData.org + R0cketShip technology.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
