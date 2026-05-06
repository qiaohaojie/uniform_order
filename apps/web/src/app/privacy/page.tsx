import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl font-semibold mb-4">Privacy policy</h1>
      <div className="space-y-3 text-[14px]" style={{ color: "var(--color-ink)" }}>
        <p>
          We collect student and parent information solely to process and fulfil uniform orders.
        </p>
        <p>
          Personal data (name, email, phone, student year and class) is stored securely and is only
          shared with the school uniform shop responsible for your order.
        </p>
        <p>
          Payment details are handled directly by Stripe; we do not store card numbers.
        </p>
        <p>
          We comply with the Australian Privacy Principles under the Privacy Act 1988. You may
          request access to or deletion of your data by contacting the school uniform shop.
        </p>
        <p>
          Order history is retained for reporting and audit purposes for up to seven years.
        </p>
      </div>
      <div className="mt-6">
        <Link href="/" className="underline text-[13px]">
          Back to home
        </Link>
      </div>
    </main>
  );
}
