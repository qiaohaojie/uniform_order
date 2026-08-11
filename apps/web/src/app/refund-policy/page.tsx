import Link from "next/link";

/**
 * Generic platform refund-policy template for the managed cloud and open-source
 * self-hosters. Per-tenant shops may publish a school-specific policy under
 * /[tenant]/refund-policy — schools should adapt this template as needed.
 */
export default function RefundPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl font-semibold mb-4">Refund policy</h1>
      <div className="space-y-4 text-[14px] leading-[1.6]" style={{ color: "var(--color-ink)" }}>
        <p className="text-[13px] rounded-md border border-rule bg-parchment px-3 py-2" style={{ color: "var(--color-ink-dim)" }}>
          This is a <strong>generic template</strong> for schools and P&amp;Cs using UniformOrder.
          Each school is the seller of record and may replace or extend this policy for their shop.
          Nothing here overrides Australian Consumer Law.
        </p>

        <h2 className="font-serif text-xl mt-6">Who handles refunds</h2>
        <p>
          The school (or its P&amp;C / uniform shop) is the seller of record. Refunds, exchanges, and
          size-change requests are decided and processed by the school — not by the UniformOrder
          platform operator.
        </p>

        <h2 className="font-serif text-xl mt-6">How to request a refund or exchange</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Contact the school using the contact details on your order confirmation or shop page.</li>
          <li>Include your order number, the item(s) concerned, and whether you want a refund or exchange.</li>
          <li>Where the shop supports it, you may open an exchange from the order detail screen.</li>
        </ul>

        <h2 className="font-serif text-xl mt-6">Typical outcomes</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Change of size / wrong size:</b> schools often exchange for another size when stock allows.</li>
          <li><b>Faulty or not as described:</b> remedies under Australian Consumer Law apply.</li>
          <li><b>Change of mind:</b> at the school&apos;s discretion; many shops do not offer change-of-mind refunds on personalised or final-sale items.</li>
        </ul>

        <h2 className="font-serif text-xl mt-6">Payments</h2>
        <p>
          Card payments are processed by Stripe on behalf of the school&apos;s connected Stripe account.
          When a school approves a refund, funds are returned via Stripe to the original payment method.
          Processing times depend on the card issuer (often 5–10 business days).
        </p>

        <h2 className="font-serif text-xl mt-6">School-specific policies</h2>
        <p>
          Self-hosted and multi-tenant deployments should publish a school-specific refund policy
          (for example at <code className="text-[13px]">/[tenant]/refund-policy</code>) and require
          parents to accept it at checkout. Adapt this template to match your P&amp;C rules,
          stock constraints, and any diocese or department requirements.
        </p>

        <h2 className="font-serif text-xl mt-6">Contact</h2>
        <p>
          For questions about a specific order, contact the school. For platform questions about
          this template, email{" "}
          <a className="underline" href="mailto:support@uniformorder.online">
            support@uniformorder.online
          </a>
          .
        </p>

        <p className="mt-8 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
          Last updated: 12 August 2026.
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
