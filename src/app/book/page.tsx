import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CalendlyEmbed from "@/components/CalendlyEmbed";

export const metadata = { title: "Book an onboarding call — KeywordCalls 🚀" };

export default function BookPage() {
  return (
    <>
      <Header />
      <section className="bg-gradient-to-b from-[color:var(--soft)] to-white">
        <div className="mx-auto max-w-3xl px-5 pt-14 pb-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white border border-[color:var(--line)] px-3 py-1 text-xs font-semibold text-[color:var(--brand)] mb-4">🚀 Onboarding</div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[color:var(--ink)]">Book your onboarding call</h1>
          <p className="mt-3 text-[color:var(--muted)] max-w-xl mx-auto">Grab a time and we&apos;ll walk you through picking your keywords, setting your bid, and getting live calls to your phone.</p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-5 pb-16">
        <CalendlyEmbed />
      </div>
      <Footer />
    </>
  );
}
