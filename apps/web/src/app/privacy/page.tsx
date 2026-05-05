import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl font-semibold mb-4">Privacy policy</h1>
      <div className="space-y-3 text-[14px]" style={{ color: "var(--color-ink)" }}>
        <p>We collect parent and student information required to process uniform orders and provide support.</p>
        <p>Payment details are processed by Stripe; card numbers are not stored in this application.</p>
        <p>Order records are retained for operations, reporting, and compliance obligations.</p>
        <p>You can request access or correction of personal information by contacting the school uniform shop.</p>
      </div>
      <div className="mt-6">
        <Link href="/" className="underline text-[13px]">
          Back to home
        </Link>
      </div>
    </main>
  );
}
