import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "var(--color-parchment)" }}>
      <h1 className="font-serif text-3xl font-semibold mb-2" style={{ color: "var(--color-ink)" }}>
        Page not found
      </h1>
      <p className="text-[14px] mb-6 max-w-md text-center" style={{ color: "var(--color-ink-dim)" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-md text-[13px] font-semibold text-white"
        style={{ background: "var(--color-navy-deep)" }}
      >
        Back to home
      </Link>
    </main>
  );
}
