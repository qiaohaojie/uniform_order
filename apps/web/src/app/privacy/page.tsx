import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-serif text-3xl font-semibold mb-4">Privacy notice</h1>
      <div className="space-y-4 text-[14px] leading-[1.6]" style={{ color: "var(--color-ink)" }}>
        <p>
          uniformorder.online is an open-source shopfront platform (MIT Licensed) that lets schools (the seller of record) sell uniforms online.
          This notice tells you what personal information we collect when you use the managed cloud service, why, where it&apos;s stored,
          how long we keep it, and how you can access or delete it. (For self-hosted instances, data governance is managed directly by your school&apos;s infrastructure administrator.)
        </p>

        <h2 className="font-serif text-xl mt-6">What we collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Your account:</b> email address and (if you sign in with Google) display name.</li>
          <li><b>Saved children profiles:</b> the name you choose to display on the order, year level, school, and (optional) roll class.</li>
          <li><b>Order details:</b> line items purchased, pickup or shipping selection, your name and mobile, payment metadata via Stripe (we do not store card numbers ourselves), and any optional note you write to the school at checkout.</li>
        </ul>

        <h2 className="font-serif text-xl mt-6">Why we collect it</h2>
        <p>
          To process and fulfil uniform orders, and so you can re-order quickly without re-typing your child&apos;s details.
          We do not sell your data and we do not market to you.
        </p>

        <h2 className="font-serif text-xl mt-6">Where it&apos;s stored</h2>
        <p>
          Order and account data is stored on Neon (a US-hosted PostgreSQL service). Payment data flows through Stripe (US).
          Transactional emails are sent via Resend. The platform itself is hosted on Hostinger.
        </p>

        <h2 className="font-serif text-xl mt-6">How long we keep it</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>Saved children profiles:</b> until you remove them or delete your account.</li>
          <li><b>Orders:</b> retained for 7 years to meet Australian record-keeping requirements. Deleting your account de-links your orders from your account but they remain on the school&apos;s records.</li>
        </ul>

        <h2 className="font-serif text-xl mt-6">Your rights</h2>
        <p>
          You can update or delete your account from <Link href="/profile" className="underline">your account settings</Link>.
        </p>
        <p>
          For refund or shipping questions about a specific order, contact the school directly — the school is the seller of record.
        </p>

        <h2 className="font-serif text-xl mt-6">Contact</h2>
        <p>
          For privacy questions about the platform itself, email <a className="underline" href="mailto:support@uniformorder.online">support@uniformorder.online</a>.
        </p>

        <p className="mt-8 text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
          Last updated: 8 May 2026.
        </p>
      </div>
    </main>
  );
}
