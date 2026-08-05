import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[color:var(--line)]">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          {/* logo is blue on transparent → sits on the bright white header */}
          <img src="/logo.png" alt="KeywordCalls" className="h-9 w-auto" />
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/#pricing" className="hidden sm:inline text-[color:var(--muted)] hover:text-[color:var(--ink)]">Pricing</Link>
          <Link href="/#how" className="hidden sm:inline text-[color:var(--muted)] hover:text-[color:var(--ink)]">How it works</Link>
          <Link href="/login" className="btn-ghost btn !py-2 !px-4">Log in</Link>
          <Link href="/signup" className="btn btn-accent !py-2 !px-4">Get started 🚀</Link>
        </nav>
      </div>
    </header>
  );
}
