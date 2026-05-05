import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl font-semibold mb-4">Terms of service</h1>
      <div className="space-y-3 text-[14px]" style={{ color: "var(--color-ink)" }}>
        <p>By placing an order, you confirm all student and parent details are accurate and complete.</p>
        <p>Orders are processed by the selected school uniform shop and are subject to school fulfillment times.</p>
        <p>Pricing is shown in Australian dollars and includes GST where applicable.</p>
        <p>Refunds and exchanges are handled under each school&apos;s refund policy and Australian Consumer Law.</p>
      </div>
      <div className="mt-6">
        <Link href="/" className="underline text-[13px]">
          Back to home
        </Link>
      </div>
    </main>
  );
}
