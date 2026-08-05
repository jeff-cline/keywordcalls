"use client";
import { useEffect } from "react";

// Embedded Calendly scheduler (calendly.com/jdcline) — the real booking widget, styled inline.
export default function CalendlyEmbed() {
  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://assets.calendly.com/assets/external/widget.js";
    s.async = true;
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);
  return (
    <div
      className="calendly-inline-widget rounded-2xl overflow-hidden border border-[color:var(--line)] bg-white"
      data-url="https://calendly.com/jdcline/book-onboarding-call?hide_gdpr_banner=1&primary_color=1b2a8f"
      style={{ minWidth: 320, height: 720 }}
    />
  );
}
