// landing.jsx — UniformOrder marketing landing page
// Sections compose into <App/>, rendered statically by src/pages/index.astro.

import {
  NAVY, NAVY_DEEP, NAVY_SOFT, PARCHMENT, PAPER, INK, INK_DIM, RULE, GOLD, ALERT, SUCCESS,
  TENANTS, SALES,
} from "../lib/tokens.jsx";
import {
  SERIF, SANS, MONO,
  Crest, PlatformMark, Btn, Chip, DoubleRule, Spark, GarmentVector,
} from "../lib/components.jsx";

const ACCENT_NAVY = NAVY;

// CTA destinations. The web app is a separate deploy on the app subdomain
// (app.uniformorder.online, Hostinger Node.js — see CLAUDE.md / astro.config.mjs).
// Demo + sales enquiries route to the inbox until a dedicated booking flow exists.
// NOTE: confirm these destinations before launch.
const SHOP_URL = "https://app.uniformorder.online";
const DEMO_MAILTO = "mailto:hello@uniformorder.online?subject=Book%20a%20UniformOrder%20demo";

// ---------- Shared bits ----------

const Kicker = ({ children, color = GOLD }) => (
  <div style={{
    fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.6,
    textTransform: 'uppercase', color
  }}>{children}</div>
);

const Eyebrow = ({ n, label, color = INK_DIM }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 11, color, letterSpacing: 0.6 }}>
    <span style={{ width: 14, height: 1, background: color, opacity: 0.4 }} />
    <span>{n}</span>
    <span style={{ opacity: 0.5 }}>·</span>
    <span style={{ textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</span>
  </div>
);

const Container = ({ children, style }) => (
  <div style={{ maxWidth: 1240, margin: '0 auto', padding: '0 40px', ...style }}>{children}</div>
);

// ---------- Nav ----------

function NavBar() {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 30,
      background: 'rgba(250, 246, 238, 0.86)',
      backdropFilter: 'saturate(120%) blur(8px)',
      WebkitBackdropFilter: 'saturate(120%) blur(8px)',
      borderBottom: `1px solid ${RULE}`,
    }}>
      <Container style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 72 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          <PlatformMark size={26} color={NAVY} />
          <nav style={{ display: 'flex', gap: 28, fontFamily: SANS, fontSize: 14, color: INK }}>
            <a href="#product" style={navLink}>Product</a>
            <a href="#schools" style={navLink}>For Schools &amp; P&amp;C</a>
            <a href="#pricing" style={navLink}>Pricing</a>
            <a href="#faq" style={navLink}>FAQ</a>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href={SHOP_URL} style={{ ...navLink, fontWeight: 600 }}>Sign in</a>
          <Btn size="sm" href={DEMO_MAILTO}>Book a 20-min demo</Btn>
        </div>
      </Container>
    </div>
  );
}
const navLink = { color: INK, textDecoration: 'none', fontWeight: 500 };

// ---------- Hero ----------

function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      {/* faint corner rule decoration */}
      <div aria-hidden style={{ position: 'absolute', top: 0, right: 0, width: 220, height: 220, pointerEvents: 'none' }}>
        <svg width="220" height="220" viewBox="0 0 220 220">
          <path d="M220 0 H40 M220 0 V180" stroke={RULE} strokeWidth="1" fill="none" />
          <path d="M220 8 H48 M212 0 V188" stroke={RULE} strokeWidth="1" fill="none" />
        </svg>
      </div>

      <Container style={{ padding: '88px 40px 96px', display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <Eyebrow n="01" label="For Australian schools &amp; P&amp;C uniform shops" />
          <h1 style={{
            fontFamily: SERIF, fontWeight: 500, fontSize: 72, lineHeight: 1.02,
            letterSpacing: -1.4, margin: '20px 0 22px', color: INK, textWrap: 'pretty',
          }}>
            The online uniform shop<br/>your P&amp;C has been<br/>
            <span style={{ fontStyle: 'italic', color: NAVY }}>waiting for.</span>
          </h1>
          <p style={{ fontFamily: SANS, fontSize: 18, lineHeight: 1.55, color: INK_DIM, maxWidth: 540, margin: '0 0 32px' }}>
            UniformOrder replaces the paper form, the spreadsheet, and the volunteer-run cash box with a clean online shop branded to your school. Parents order from their phone, your P&amp;C packs from a tablet, and payouts land straight in the school&rsquo;s bank account.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <Btn size="lg" href={SHOP_URL}>Start a 30-day free trial</Btn>
            <Btn size="lg" variant="secondary" href={DEMO_MAILTO}>Book a 20-min demo</Btn>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontFamily: SANS, fontSize: 13, color: INK_DIM }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Dot color={SUCCESS}/> No card to start
            </span>
            <span style={{ width: 1, height: 12, background: RULE }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Dot color={SUCCESS}/> Payouts via Stripe Connect
            </span>
            <span style={{ width: 1, height: 12, background: RULE }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Dot color={SUCCESS}/> Hosted in Sydney
            </span>
          </div>
        </div>

        <HeroVisual />
      </Container>
    </section>
  );
}

const Dot = ({ color }) => (
  <span style={{ width: 6, height: 6, borderRadius: 999, background: color, display: 'inline-block' }} />
);

// Stacked mocks: a parent phone shop + an admin kanban card
function HeroVisual() {
  return (
    <div style={{ position: 'relative', minHeight: 540 }}>
      {/* Admin order card — behind */}
      <div style={{
        position: 'absolute', right: 0, top: 30, width: 460,
        background: PAPER, border: `1px solid ${RULE}`, borderRadius: 10, padding: 20,
        boxShadow: '0 24px 60px -30px rgba(15, 33, 54, 0.35)',
        transform: 'rotate(1.2deg)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: INK_DIM, letterSpacing: 0.6 }}>OPERATOR · ORDERS</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip tone="info" size="sm">New · 3</Chip>
            <Chip tone="warn" size="sm">Packing · 2</Chip>
            <Chip tone="success" size="sm">Ready · 2</Chip>
          </div>
        </div>
        <DoubleRule/>
        <div style={{ marginTop: 12 }}>
          {[
            { id: 'IMHS-04298', name: 'Riley Qiao', year: 'Y9', items: 6, total: 363, tone: 'navy', status: 'New' },
            { id: 'IMHS-04297', name: 'Arjun Patel', year: 'Y7', items: 4, total: 178, tone: 'navy', status: 'New' },
            { id: 'IMHS-04295', name: 'Tom Whitlam', year: 'Y8', items: 8, total: 412, tone: 'warn', status: 'Packing' },
            { id: 'IMHS-04293', name: 'Luka Kovac', year: 'Y10', items: 5, total: 240, tone: 'success', status: 'Ready' },
          ].map((o, i) => (
            <div key={o.id} style={{
              display: 'grid', gridTemplateColumns: '110px 1fr auto auto', gap: 12, alignItems: 'center',
              padding: '10px 0', borderBottom: i < 3 ? `1px solid ${RULE}` : 'none', fontFamily: SANS, fontSize: 13,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: NAVY, fontWeight: 600 }}>{o.id}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{o.name} <span style={{ color: INK_DIM, fontWeight: 400 }}>· {o.year}</span></div>
                <div style={{ color: INK_DIM, fontSize: 12 }}>{o.items} items</div>
              </div>
              <div style={{ fontFeatureSettings: '"tnum"', fontWeight: 600 }}>${o.total}.00</div>
              <Chip tone={o.tone} size="sm">{o.status}</Chip>
            </div>
          ))}
        </div>
      </div>

      {/* Parent phone — front */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: 280,
        background: NAVY, borderRadius: 38, padding: 8,
        boxShadow: '0 40px 80px -30px rgba(8, 26, 45, 0.5), 0 8px 18px -8px rgba(8, 26, 45, 0.4)',
        transform: 'rotate(-2deg)',
      }}>
        <div style={{ background: PARCHMENT, borderRadius: 30, overflow: 'hidden', height: 540 }}>
          {/* status bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px 8px', fontFamily: SANS, fontSize: 12, color: INK, fontWeight: 600 }}>
            <span>8:42</span>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <span style={{ width: 16, height: 8, border: `1px solid ${INK}`, borderRadius: 2 }}/>
            </span>
          </div>
          {/* tenant bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px 14px' }}>
            <Crest tenant={TENANTS.nsbh} size={36} />
            <div>
              <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1 }}>IMHS</div>
              <div style={{ fontFamily: SANS, fontSize: 10, color: INK_DIM, marginTop: 2 }}>Uniform shop</div>
            </div>
            <div style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 999, background: '#fff', border: `1px solid ${RULE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 16 16"><path d="M2 4 H14 L13 12 H3 Z" fill="none" stroke={NAVY} strokeWidth="1.2"/><circle cx="6" cy="14" r="0.8" fill={NAVY}/><circle cx="11" cy="14" r="0.8" fill={NAVY}/></svg>
            </div>
          </div>
          <DoubleRule/>
          {/* category */}
          <div style={{ padding: '12px 18px 0', display: 'flex', gap: 6, overflowX: 'hidden' }}>
            <Chip tone="navy" size="sm">Winter</Chip>
            <Chip tone="neutral" size="sm">Summer</Chip>
            <Chip tone="neutral" size="sm">Sports</Chip>
            <Chip tone="neutral" size="sm">Bags</Chip>
          </div>
          {/* items */}
          <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { id: 'jumper', name: 'Jumper', price: 75 },
              { id: 'shirt-ls', name: 'Long-sleeve shirt', price: 28 },
              { id: 'trousers', name: 'Trousers', price: 18 },
              { id: 'tie', name: 'School tie', price: 20 },
            ].map((p) => (
              <div key={p.id} style={{ background: '#fff', border: `1px solid ${RULE}`, borderRadius: 6, overflow: 'hidden' }}>
                <GarmentVector kind={p.id} accent={NAVY_SOFT} size={110} />
                <div style={{ padding: '6px 8px 8px' }}>
                  <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 600, color: INK }}>{p.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: NAVY, fontWeight: 600, marginTop: 1 }}>${p.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Trust strip ----------

function TrustStrip() {
  const crests = [
    { id: 'nsbh', short: 'IMHS', accent: '#7A1F2B' },
    { id: 'rgsh', short: 'RGHS', accent: '#2F5D50' },
    { id: 'kbhs', short: 'KHS', accent: '#1F3A6E' },
    { id: 'spc',  short: 'SPC',  accent: '#4A2238' },
    { id: 'mbgs', short: 'MBGS', accent: '#0F4C5C' },
    { id: 'cgs',  short: 'CGS',  accent: '#6E3B5C' },
  ];
  return (
    <section style={{ background: PAPER, borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
      <Container style={{ padding: '36px 40px', display: 'flex', alignItems: 'center', gap: 40, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: INK_DIM, letterSpacing: 1.2, textTransform: 'uppercase', maxWidth: 200 }}>
          Now powering uniform shops at
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
          {crests.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crest tenant={t} size={32} />
              <span style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600, color: INK }}>{t.short}</span>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------- Problem ----------

function ProblemSection() {
  const items = [
    {
      kicker: 'Today',
      title: 'Paper order forms',
      body: 'Parents fill out the same PDF every January. Sizes get illegible, totals get added up wrong, and the form has to be retyped into the till.',
    },
    {
      kicker: 'Today',
      title: 'Volunteer-run spreadsheet',
      body: 'One P&C volunteer keeps the master Excel of stock, prices and orders. When she goes on holiday, the shop closes.',
    },
    {
      kicker: 'Today',
      title: 'Cash, EFTPOS, and pickup chaos',
      body: 'Saturday morning queues, lost receipts, and reconciling cash with the school bursar at the end of every term.',
    },
  ];
  return (
    <section style={{ background: PARCHMENT, paddingTop: 96, paddingBottom: 24 }}>
      <Container>
        <Eyebrow n="02" label="The problem" />
        <h2 style={{
          fontFamily: SERIF, fontWeight: 500, fontSize: 48, lineHeight: 1.1, letterSpacing: -0.8,
          margin: '20px 0 18px', color: INK, maxWidth: 820,
        }}>
          Most Australian schools still run their uniform shop like it&rsquo;s <span style={{ fontStyle: 'italic' }}>1998</span>.
        </h2>
        <p style={{ fontFamily: SANS, fontSize: 17, lineHeight: 1.55, color: INK_DIM, maxWidth: 720, margin: 0 }}>
          The uniform shop is usually run by one or two parent volunteers on top of full-time jobs. Most of their time goes to data entry and reconciliation, not to families. We&rsquo;ve seen it up close — and built UniformOrder around the way these shops actually work.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 48 }}>
          {items.map((it, i) => (
            <div key={i} style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: 10, padding: 24 }}>
              <Kicker color={ALERT}>{it.kicker}</Kicker>
              <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500, color: INK, margin: '10px 0 10px', letterSpacing: -0.2 }}>{it.title}</div>
              <div style={{ fontFamily: SANS, fontSize: 14, lineHeight: 1.55, color: INK_DIM }}>{it.body}</div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ---------- Features (Product Tour) ----------

function FeatureRow({ n, kicker, title, body, bullets, visual, reverse }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center',
      padding: '64px 0', borderTop: `1px solid ${RULE}`,
    }}>
      <div style={{ order: reverse ? 2 : 1 }}>
        <Eyebrow n={n} label={kicker} />
        <h3 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 38, lineHeight: 1.1, letterSpacing: -0.6, margin: '16px 0 16px', color: INK }}>{title}</h3>
        <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: INK_DIM, margin: '0 0 24px' }}>{body}</p>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, fontFamily: SANS, fontSize: 14.5, color: INK, lineHeight: 1.5 }}>
              <Check/>
              <span><b style={{ fontWeight: 600 }}>{b.head}.</b> <span style={{ color: INK_DIM }}>{b.body}</span></span>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ order: reverse ? 1 : 2 }}>{visual}</div>
    </div>
  );
}

const Check = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" style={{ flexShrink: 0, marginTop: 2 }}>
    <circle cx="9" cy="9" r="8.5" fill="none" stroke={GOLD} strokeWidth="1"/>
    <path d="M5.5 9.5 L8 12 L13 6.8" stroke={GOLD} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function ParentVisual() {
  return (
    <div style={{ background: PARCHMENT, border: `1px solid ${RULE}`, borderRadius: 14, padding: 36, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: 290, background: NAVY, borderRadius: 38, padding: 8,
        boxShadow: '0 30px 60px -30px rgba(8,26,45,0.45)' }}>
        <div style={{ background: '#fff', borderRadius: 30, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${RULE}` }}>
            <Crest tenant={TENANTS.nsbh} size={28} />
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 14 }}>Cart</div>
            <div style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 11, color: INK_DIM }}>3 items</div>
          </div>
          {[
            { name: 'Jumper — Wool Blend', size: 'Size 16', qty: 1, price: 75, k: 'jumper' },
            { name: 'Long-sleeve Shirt', size: 'Boys 14', qty: 2, price: 28, k: 'shirt-ls' },
            { name: 'School Tie', size: 'One size', qty: 1, price: 20, k: 'tie' },
          ].map((r) => (
            <div key={r.name} style={{ display: 'flex', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${RULE}` }}>
              <div style={{ width: 52, height: 52, background: PARCHMENT, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                <GarmentVector kind={r.k} accent={NAVY_SOFT} size={52} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: INK }}>{r.name}</div>
                <div style={{ fontFamily: SANS, fontSize: 11, color: INK_DIM, marginTop: 2 }}>{r.size} · Qty {r.qty}</div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: INK, alignSelf: 'center' }}>${r.qty * r.price}</div>
            </div>
          ))}
          <div style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 12, color: INK_DIM, marginBottom: 4 }}>
              <span>Subtotal</span><span style={{ fontFeatureSettings: '"tnum"'}}>$131.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SANS, fontSize: 12, color: INK_DIM, marginBottom: 8 }}>
              <span>Pickup</span><span>Free</span>
            </div>
            <DoubleRule/>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: SERIF, fontSize: 18, fontWeight: 600, padding: '10px 0 12px' }}>
              <span>Total</span><span style={{ fontFeatureSettings: '"tnum"'}}>$131.00</span>
            </div>
            <Btn fullWidth size="md" accent={TENANTS.nsbh.accent}>Pay $131.00</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function OperatorVisual() {
  const cols = [
    { name: 'New', tone: 'info', items: [
      { id: 'IMHS-04298', kid: 'Riley Qiao', year: 'Y9', total: 363 },
      { id: 'IMHS-04297', kid: 'Arjun Patel', year: 'Y7', total: 178 },
      { id: 'IMHS-04296', kid: 'Ethan Chen', year: 'Y11', total: 102 },
    ]},
    { name: 'Packing', tone: 'warn', items: [
      { id: 'IMHS-04295', kid: 'Tom Whitlam', year: 'Y8', total: 412 },
      { id: 'IMHS-04294', kid: 'Mateo Moreno', year: 'Y9', total: 95 },
    ]},
    { name: 'Ready', tone: 'success', items: [
      { id: 'IMHS-04293', kid: 'Luka Kovac', year: 'Y10', total: 240 },
      { id: 'IMHS-04292', kid: 'Oliver Zhang', year: 'Y7', total: 388 },
    ]},
  ];
  return (
    <div style={{ background: NAVY_DEEP, borderRadius: 14, padding: 26, boxShadow: '0 40px 80px -40px rgba(8,26,45,0.6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Crest tenant={TENANTS.nsbh} size={26} />
          <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 600, color: '#fff' }}>IMHS · Order queue</div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.6 }}>Mon, 11 May · 9:42am</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {cols.map(c => (
          <div key={c.name} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 10, minHeight: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 1, textTransform: 'uppercase' }}>{c.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>{c.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.items.map(it => (
                <div key={it.id} style={{ background: '#fff', borderRadius: 6, padding: 10 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: NAVY, fontWeight: 600, letterSpacing: 0.4 }}>{it.id}</div>
                  <div style={{ fontFamily: SANS, fontSize: 12, fontWeight: 600, color: INK, marginTop: 2 }}>{it.kid}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6, fontFamily: SANS, fontSize: 11, color: INK_DIM }}>
                    <span>{it.year}</span>
                    <span style={{ fontFamily: MONO, fontWeight: 600, color: INK }}>${it.total}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsVisual() {
  return (
    <div style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: 14, padding: 28 }}>
      {/* Headline metric row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, paddingBottom: 18, borderBottom: `1px solid ${RULE}` }}>
        {[
          { l: 'Revenue · 30d', v: '$18,420', spark: SALES.spark },
          { l: 'Orders · 30d', v: '312', spark: SALES.spark.map(x=>x*0.7) },
          { l: 'Avg order', v: '$59.04', spark: SALES.spark.map(x=>40 + (x%14)) },
        ].map((m, i) => (
          <div key={i}>
            <div className="ds-label" style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: INK_DIM, letterSpacing: 0.6, textTransform: 'uppercase' }}>{m.l}</div>
            <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: INK, marginTop: 6, marginBottom: 6, fontFeatureSettings: '"tnum"' }}>{m.v}</div>
            <Spark data={m.spark} w={120} h={28} color={NAVY} />
          </div>
        ))}
      </div>
      {/* Top items table */}
      <div style={{ paddingTop: 18 }}>
        <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, color: INK_DIM, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Top items — 30 days</div>
        {SALES.topItems.slice(0,5).map((t, i) => {
          const max = SALES.topItems[0].qty;
          const pct = (t.qty / max) * 100;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px', gap: 12, alignItems: 'center', padding: '8px 0', borderTop: i ? `1px solid ${RULE}` : 'none' }}>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 13, color: INK, fontWeight: 500 }}>{t.name}</div>
                <div style={{ height: 4, background: '#EFE9D9', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: NAVY }} />
                </div>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: INK_DIM, textAlign: 'right' }}>{t.qty}</div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: INK, textAlign: 'right', fontFeatureSettings: '"tnum"' }}>${t.revenue.toLocaleString()}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductSection() {
  return (
    <section id="product" style={{ background: PARCHMENT, paddingTop: 64, paddingBottom: 64 }}>
      <Container>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Eyebrow n="03" label="The product" />
          <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 48, lineHeight: 1.1, letterSpacing: -0.8, margin: '16px auto 12px', color: INK, maxWidth: 760 }}>
            One platform. Three windows into your uniform shop.
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 17, color: INK_DIM, maxWidth: 640, margin: '0 auto', lineHeight: 1.55 }}>
            Every screen is designed for the person who actually uses it: a tired parent on the train, a P&amp;C volunteer in the shop, and the school treasurer at month-end.
          </p>
        </div>

        <FeatureRow
          n="3.1"
          kicker="For parents"
          title="A school uniform shop that fits in their pocket."
          body="Branded to each school with the crest and accent colour your families already recognise. No app to download, no account to create — just a link from your school newsletter."
          bullets={[
            { head: 'Mobile-first checkout', body: 'Designed first for the phone, not retrofitted. Big tap targets, Apple Pay & Google Pay one-tap.' },
            { head: 'Sizes that make sense', body: 'Per-item size guides in cm. Parents see chest, sleeve and length the way the form already lists them.' },
            { head: 'Re-order from last year', body: 'Last January&rsquo;s order comes back as a draft. Bump sizes up, tap pay.' },
          ]}
          visual={<ParentVisual />}
        />

        <FeatureRow
          n="3.2"
          kicker="For P&amp;C volunteers"
          title="Run the shop from a tablet on a Tuesday morning."
          body="A simple Kanban-style queue: new → packing → ready → collected. Print pick slips, swap a size, refund a top, all without picking up a calculator."
          bullets={[
            { head: 'Order kanban', body: 'Drag a card from packing to ready and the parent gets an email automatically.' },
            { head: 'Bulk upload your catalog', body: 'Import the spreadsheet you already have. Edit prices in-line. Roll out new stock in minutes.' },
            { head: 'Refunds & exchanges', body: 'Tap the order, choose &ldquo;exchange&rdquo;, pick a new size. Stripe handles the money.' },
          ]}
          visual={<OperatorVisual />}
          reverse
        />

        <FeatureRow
          n="3.3"
          kicker="For the treasurer"
          title="Reconciliation in 60 seconds, not 60 minutes."
          body="Every payment lands directly in the school&rsquo;s nominated bank account via Stripe Connect — we never touch the money. Export GST-ready monthly statements straight from the dashboard."
          bullets={[
            { head: 'Direct to school&rsquo;s Stripe', body: 'Funds payout into your school&rsquo;s own Stripe account daily. We take a flat platform fee, not a percentage of your float.' },
            { head: 'GST-ready exports', body: 'CSV exports of revenue, refunds and platform fees, formatted for your accountant or MYOB.' },
            { head: 'Live revenue, no surprises', body: 'See today&rsquo;s takings on the dashboard. No more waiting for a volunteer to email a spreadsheet.' },
          ]}
          visual={<ReportsVisual />}
        />
      </Container>
    </section>
  );
}

// ---------- Built-for-AU ----------

function BuiltForSchoolsSection() {
  const features = [
    { title: 'Stripe Connect destination charges', body: 'Money flows from the parent&rsquo;s card straight into the school&rsquo;s bank account. We are a payment facilitator, not a custodian.' },
    { title: 'Privacy Act 1988 compliant',         body: 'Student data is treated as personal information. Data lives in AWS Sydney. We never sell or share it.' },
    { title: 'Refund &amp; exchange policy at checkout', body: 'Parents must accept your refund policy before payment. Consent is timestamped against the order.' },
    { title: 'AU-formatted everywhere',            body: 'DD/MM dates, AUD with GST inclusive labels, Year 7-12 sizing. No US-isms.' },
    { title: 'P&amp;C-friendly billing',                body: 'No long-term contracts. Cancel any month. We invoice the P&amp;C, not the parents.' },
    { title: 'Bring-your-own domain',              body: 'Run the shop on uniforms.your-school.nsw.edu.au. We&rsquo;ll set up the DNS and SSL for you.' },
  ];
  return (
    <section id="schools" style={{ background: NAVY, color: '#fff', padding: '96px 0' }}>
      <Container>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 80, alignItems: 'start' }}>
          <div>
            <Eyebrow n="04" label="For Australian schools" color="rgba(255,255,255,0.65)" />
            <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 48, lineHeight: 1.1, letterSpacing: -0.8, margin: '20px 0 18px' }}>
              Built around how Australian schools <span style={{ fontStyle: 'italic' }}>actually</span> work.
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)', margin: '0 0 28px', maxWidth: 460 }}>
              We&rsquo;ve worked alongside P&amp;C uniform-shop conveners in NSW, VIC and QLD. The platform respects the way you already operate — and the obligations that come with handling families&rsquo; money.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Btn size="md">Talk to our team</Btn>
              <Btn size="md" variant="secondary" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>Read the security brief</Btn>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {features.map((f, i) => (
              <div key={i} style={{
                padding: '20px 22px',
                borderTop: `1px solid rgba(255,255,255,0.12)`,
                borderLeft: i % 2 === 1 ? `1px solid rgba(255,255,255,0.12)` : 'none',
                borderBottom: i >= features.length - 2 ? `1px solid rgba(255,255,255,0.12)` : 'none',
              }}>
                <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 17, marginBottom: 8, color: '#fff' }} dangerouslySetInnerHTML={{ __html: f.title }} />
                <div style={{ fontFamily: SANS, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }} dangerouslySetInnerHTML={{ __html: f.body }} />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

// ---------- Quote ----------

function QuoteSection() {
  return (
    <section style={{ background: PARCHMENT, padding: '96px 0' }}>
      <Container style={{ textAlign: 'center', maxWidth: 880 }}>
        <svg width="40" height="32" viewBox="0 0 40 32" style={{ marginBottom: 24 }}>
          <path d="M0 32 V18 Q0 4 14 0 L16 6 Q6 8 6 18 H14 V32 Z M22 32 V18 Q22 4 36 0 L38 6 Q28 8 28 18 H36 V32 Z" fill={GOLD} opacity="0.6"/>
        </svg>
        <p style={{ fontFamily: SERIF, fontWeight: 400, fontStyle: 'italic', fontSize: 32, lineHeight: 1.35, color: INK, margin: '0 0 28px', letterSpacing: -0.3 }}>
          We used to spend two Saturdays before back-to-school just sorting paper forms. The first January on UniformOrder we packed 312 orders without staying past 11am — and the bursar got the bank reconciliation by lunchtime.
        </p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 14 }}>
          <Crest tenant={TENANTS.nsbh} size={44} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontFamily: SANS, fontSize: 14, fontWeight: 600, color: INK }}>Margaret Whitlam</div>
            <div style={{ fontFamily: SANS, fontSize: 12, color: INK_DIM, marginTop: 2 }}>P&amp;C President · North Sydney Boys High School</div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ---------- Pricing ----------

function PricingSection() {
  return (
    <section id="pricing" style={{ background: PAPER, padding: '96px 0', borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
      <Container>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Eyebrow n="05" label="Pricing" />
          <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 48, lineHeight: 1.1, letterSpacing: -0.8, margin: '16px 0 12px', color: INK }}>
            Honest pricing for non-profit P&amp;Cs.
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 17, color: INK_DIM, maxWidth: 600, margin: '0 auto', lineHeight: 1.55 }}>
            A flat monthly fee. Stripe&rsquo;s standard processing fees on top — we don&rsquo;t mark them up.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, alignItems: 'stretch' }}>
          <PlanCard
            name="Trial"
            price="Free"
            sub="30 days, no card required"
            features={[
              'All Standard features',
              'Up to 25 live orders',
              'Sandbox Stripe account',
              'Email support',
            ]}
            cta="Start free trial"
            href={SHOP_URL}
          />
          <PlanCard
            name="Standard"
            price="$149"
            unit="/ month"
            sub="The plan most schools start on"
            highlight
            features={[
              'Unlimited parents &amp; orders',
              'Full Kanban + bulk catalog upload',
              'Direct Stripe Connect payouts',
              'GST-ready monthly exports',
              'Custom domain &amp; branding',
              'Priority email + phone support',
            ]}
            cta="Start free trial"
            href={SHOP_URL}
          />
          <PlanCard
            name="Multi-campus"
            price="Talk to us"
            sub="For school groups &amp; dioceses"
            features={[
              'Everything in Standard',
              'Multiple campuses, one console',
              'SSO for staff (Microsoft / Google)',
              'Custom contracts &amp; invoicing',
              'Dedicated onboarding',
            ]}
            cta="Book a demo"
            href={DEMO_MAILTO}
          />
        </div>
        <div style={{ marginTop: 32, textAlign: 'center', fontFamily: SANS, fontSize: 13, color: INK_DIM }}>
          Stripe processing: 1.7% + A$0.30 (domestic). Refunded fees are not retained.
        </div>
      </Container>
    </section>
  );
}

function PlanCard({ name, price, unit, sub, features, cta, highlight, href }) {
  return (
    <div style={{
      background: highlight ? NAVY : '#fff',
      color: highlight ? '#fff' : INK,
      border: `1px solid ${highlight ? NAVY : RULE}`,
      borderRadius: 12,
      padding: 28,
      display: 'flex', flexDirection: 'column',
      position: 'relative',
      boxShadow: highlight ? '0 30px 60px -30px rgba(8,26,45,0.4)' : 'none',
    }}>
      {highlight && (
        <div style={{ position: 'absolute', top: -10, left: 24, background: GOLD, color: '#fff', fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 1.4, padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase' }}>
          Most schools choose this
        </div>
      )}
      <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, marginBottom: 6 }}>{name}</div>
      <div style={{ fontFamily: SANS, fontSize: 13, color: highlight ? 'rgba(255,255,255,0.7)' : INK_DIM, marginBottom: 18 }}>{sub}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 20 }}>
        <div style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 500, letterSpacing: -1 }}>{price}</div>
        {unit && <div style={{ fontFamily: SANS, fontSize: 14, color: highlight ? 'rgba(255,255,255,0.6)' : INK_DIM }}>{unit}</div>}
      </div>
      <div style={{ height: 1, background: highlight ? 'rgba(255,255,255,0.15)' : RULE, marginBottom: 18 }} />
      <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {features.map((f, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, fontFamily: SANS, fontSize: 14, color: highlight ? 'rgba(255,255,255,0.85)' : INK }}>
            <svg width="14" height="14" viewBox="0 0 14 14" style={{ marginTop: 3, flexShrink: 0 }}>
              <path d="M3 7.5 L6 10 L11 5" stroke={highlight ? GOLD : NAVY} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span dangerouslySetInnerHTML={{ __html: f }} />
          </li>
        ))}
      </ul>
      <Btn
        fullWidth
        href={href}
        variant={highlight ? 'primary' : 'secondary'}
        accent={highlight ? GOLD : NAVY}
        style={highlight ? { background: '#fff', color: NAVY, borderColor: '#fff' } : {}}
      >{cta}</Btn>
    </div>
  );
}

// ---------- FAQ ----------

// Native <details> = zero-JS accordion (no React shipped to the client).
// The +/− indicator is driven by CSS in global.css (.faq-mark / [open]).
function FAQItem({ q, a, defaultOpen }) {
  return (
    <details className="faq-item" open={!!defaultOpen} style={{ borderTop: `1px solid ${RULE}`, padding: '20px 0' }}>
      <summary className="faq-summary"
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 500, color: INK, letterSpacing: -0.2 }}>{q}</div>
        <span className="faq-mark" aria-hidden="true"
          style={{ fontFamily: SERIF, fontSize: 22, color: NAVY, fontWeight: 300, width: 24, textAlign: 'center' }}></span>
      </summary>
      <div style={{ fontFamily: SANS, fontSize: 15, color: INK_DIM, lineHeight: 1.6, marginTop: 12, maxWidth: 760 }}
        dangerouslySetInnerHTML={{ __html: a }}/>
    </details>
  );
}

function FAQSection() {
  const faqs = [
    { q: 'Who owns the money — UniformOrder or the school?',
      a: 'The school does. Payments use Stripe Connect destination charges, so funds settle directly into <em>your school&rsquo;s</em> Stripe account and payout into <em>your school&rsquo;s</em> bank account. UniformOrder never holds your float.' },
    { q: 'Is this just for NSW schools?',
      a: 'No. We started with NSW high schools but the platform is built for any Australian school running a uniform shop — public, Catholic or independent, primary or secondary, in any state. AUD pricing, AU date formats, GST-ready exports.', defaultOpen: true },
    { q: 'What happens to our existing paper order form?',
      a: 'During onboarding we&rsquo;ll digitise it for you. Send us the PDF and an Excel/Word price list — we set up the categories, items and sizing tables in your shop, and you review before launch. Usually two business days.' },
    { q: 'Does the P&amp;C still need a Stripe account?',
      a: 'Yes — but we walk one of your P&amp;C office-bearers through the Stripe Connect onboarding (it takes ~15 minutes and asks for the P&amp;C ABN, bank account, and one director&rsquo;s ID). The platform won&rsquo;t go live until Stripe has approved your account.' },
    { q: 'What about second-hand uniforms and donated stock?',
      a: 'Each item can be flagged as &ldquo;new&rdquo; or &ldquo;second-hand&rdquo; with separate stock and pricing. Donated stock is fully supported, and you can offer it free or for a nominal fee.' },
    { q: 'Can parents pay with school credit / vouchers?',
      a: 'Yes — operators can issue store credit codes (e.g. for refunds or BackToSchool vouchers) which parents apply at checkout. Useful for low-SES support programs run by the P&amp;C.' },
    { q: 'How long does it take to switch over?',
      a: 'Most schools are live within 5–10 business days of signing up — that includes catalog digitisation, Stripe Connect approval, custom-domain setup, and a 30-minute training call with your volunteers.' },
  ];
  return (
    <section id="faq" style={{ background: PARCHMENT, padding: '96px 0' }}>
      <Container style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80 }}>
        <div>
          <Eyebrow n="06" label="FAQ" />
          <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 40, lineHeight: 1.1, letterSpacing: -0.6, margin: '16px 0 16px', color: INK }}>
            Questions P&amp;C presidents tend to ask first.
          </h2>
          <p style={{ fontFamily: SANS, fontSize: 15, lineHeight: 1.6, color: INK_DIM }}>
            Can&rsquo;t see what you&rsquo;re after? <a href="mailto:hello@uniformorder.online" style={{ color: NAVY, textDecoration: 'underline' }}>Email us</a> — a real human replies, usually within the same day.
          </p>
        </div>
        <div>
          {faqs.map((f, i) => <FAQItem key={i} {...f} />)}
          <div style={{ borderTop: `1px solid ${RULE}` }} />
        </div>
      </Container>
    </section>
  );
}

// ---------- CTA banner ----------

function CTABanner() {
  return (
    <section style={{ background: PAPER, padding: '96px 0' }}>
      <Container>
        <div style={{
          background: NAVY, borderRadius: 16, padding: '64px 56px', color: '#fff',
          display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 60, alignItems: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          <svg aria-hidden style={{ position: 'absolute', right: -20, bottom: -40, opacity: 0.08 }}
               width="360" height="360" viewBox="0 0 360 360">
            <circle cx="180" cy="180" r="170" stroke="#fff" strokeWidth="1" fill="none"/>
            <circle cx="180" cy="180" r="130" stroke="#fff" strokeWidth="1" fill="none"/>
            <circle cx="180" cy="180" r="90" stroke="#fff" strokeWidth="1" fill="none"/>
            <circle cx="180" cy="180" r="50" stroke="#fff" strokeWidth="1" fill="none"/>
          </svg>
          <div>
            <Eyebrow n="07" label="Get started" color="rgba(255,255,255,0.6)" />
            <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 44, lineHeight: 1.1, letterSpacing: -0.6, margin: '16px 0 14px' }}>
              Give your P&amp;C their Saturdays back.
            </h2>
            <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,0.75)', maxWidth: 480, margin: 0 }}>
              30 days free. No credit card. We&rsquo;ll digitise your paper order form for free as part of onboarding — so the first thing your volunteers see is their own shop, with their own items, ready to take orders.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Btn size="lg" href={SHOP_URL} style={{ background: '#fff', color: NAVY, borderColor: '#fff' }}>Start a 30-day free trial</Btn>
            <Btn size="lg" variant="secondary" href={DEMO_MAILTO} style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}>Book a 20-minute demo</Btn>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 0.6, marginTop: 6 }}>
              Or call 02 8123 4567 · weekdays 9–5 AEST
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

// ---------- Footer ----------

function Footer() {
  const cols = [
    { h: 'Product', links: ['Parent shop', 'Operator dashboard', 'Reports & exports', 'Bulk catalog upload', 'Security'] },
    { h: 'For schools', links: ['NSW Department schools', 'Independent schools', 'Catholic systemic', 'Primary schools', 'P&C resources'] },
    { h: 'Company', links: ['About', 'Pricing', 'Contact', 'Changelog'] },
    { h: 'Legal', links: ['Terms of Service', 'Privacy Policy', 'Refund policy', 'Security brief'] },
  ];
  return (
    <footer style={{ background: NAVY_DEEP, color: 'rgba(255,255,255,0.7)', padding: '64px 0 32px' }}>
      <Container>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(4, 1fr)', gap: 40, paddingBottom: 48, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <PlatformMark size={28} color="#fff" />
            <p style={{ fontFamily: SANS, fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.55)', marginTop: 16, maxWidth: 280 }}>
              Online uniform shop software for Australian schools and Parents &amp; Citizens Associations. Made in Sydney.
            </p>
          </div>
          {cols.map(c => (
            <div key={c.h}>
              <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#fff', marginBottom: 14 }}>{c.h}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {c.links.map(l => (
                  <li key={l}><a href="#" style={{ fontFamily: SANS, fontSize: 13.5, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: MONO, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.6 }}>
          <span>© 2026 UniformOrder Pty Ltd · ABN 12 345 678 910</span>
          <span>uniformorder.online</span>
        </div>
      </Container>
    </footer>
  );
}

// ---------- App ----------

function App() {
  return (
    <div>
      <NavBar />
      <Hero />
      {/* Hidden until we have live schools to showcase — restore when customers are onboarded. */}
      {/* <TrustStrip /> */}
      <ProblemSection />
      <ProductSection />
      <BuiltForSchoolsSection />
      <QuoteSection />
      <PricingSection />
      <FAQSection />
      <CTABanner />
      <Footer />
    </div>
  );
}

export { App };
