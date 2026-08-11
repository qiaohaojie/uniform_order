import Link from "next/link";

/**
 * Generic legal notices for the managed cloud and open-source template.
 * Schools should adapt notices for their own entity, ABN, and jurisdiction.
 */
export default function LegalNoticesPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl font-semibold mb-4">Legal notices</h1>
      <div className="space-y-4 text-[14px] leading-[1.6]" style={{ color: "var(--color-ink)" }}>
        <p className="text-[13px] rounded-md border border-rule bg-parchment px-3 py-2" style={{ color: "var(--color-ink-dim)" }}>
          This page is a <strong>generic template</strong>. Self-hosted schools and P&amp;Cs should
          replace entity names, contacts, and jurisdiction with their own details before go-live.
        </p>

        <h2 className="font-serif text-xl mt-6">Software licence</h2>
        <p>
          The UniformOrder application source code is released under the{" "}
          <a
            className="underline"
            href="https://github.com/qiaohaojie/uniform_order/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT License
          </a>
          . You may use, copy, modify, and distribute the software subject to that licence.
          The software is provided &quot;as is&quot;, without warranty of any kind.
        </p>

        <h2 className="font-serif text-xl mt-6">Managed cloud vs self-hosted</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <b>Managed cloud</b> (<span className="tnum">uniformorder.online</span>): platform
            infrastructure is operated for participating schools. Each school remains the seller of
            record for uniform sales.
          </li>
          <li>
            <b>Self-hosted:</b> the school (or its IT provider) operates the instance, controls
            data, and is responsible for its own privacy, security, and consumer-law compliance.
          </li>
        </ul>

        <h2 className="font-serif text-xl mt-6">Seller of record</h2>
        <p>
          Uniform items are sold by the school or its authorised P&amp;C / uniform shop — not by the
          open-source project maintainers. Pricing, stock, fulfilment, and customer service for
          orders sit with that school.
        </p>

        <h2 className="font-serif text-xl mt-6">Payments</h2>
        <p>
          Online card payments use Stripe Connect. Funds settle to the school&apos;s connected Stripe
          account subject to Stripe&apos;s terms and the school&apos;s payout settings. Card data is
          handled by Stripe; the platform does not store full card numbers.
        </p>

        <h2 className="font-serif text-xl mt-6">Related policies</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <Link href="/terms" className="underline">
              Terms of service
            </Link>
          </li>
          <li>
            <Link href="/privacy" className="underline">
              Privacy notice
            </Link>
          </li>
          <li>
            <Link href="/refund-policy" className="underline">
              Refund policy (template)
            </Link>
          </li>
          <li>
            <a
              className="underline"
              href="https://github.com/qiaohaojie/uniform_order/blob/main/SECURITY.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Security policy
            </a>
          </li>
        </ul>

        <h2 className="font-serif text-xl mt-6">Contact</h2>
        <p>
          Platform enquiries:{" "}
          <a className="underline" href="mailto:support@uniformorder.online">
            support@uniformorder.online
          </a>
          . For order issues, contact the school named on your receipt.
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
