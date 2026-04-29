// parent.jsx — Mobile-first parent ordering experience for UniformOrder.
// Each exported component renders a single iPhone-sized screen (390x844).
// Composed inside design_canvas artboards.

const PHONE_W = 390;
const PHONE_H = 844;

// Shared phone shell — chrome rounded, status bar, optional bottom safe area.
function Phone({ children, bg = PAPER, statusDark = false }) {
  return (
    <div style={{ width: PHONE_W, height: PHONE_H, background: bg, position: 'relative',
      fontFamily: SANS, color: INK, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <PhoneStatusBar dark={statusDark} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
    </div>
  );
}

function PhoneStatusBar({ dark }) {
  const fg = dark ? '#fff' : INK;
  return (
    <div style={{ height: 44, padding: '0 24px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', flexShrink: 0, fontFamily: SANS, color: fg }}>
      <div style={{ fontSize: 15, fontWeight: 600, fontFeatureSettings: '"tnum"' }}>9:41</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><path d="M0 9h2v2H0zm4-2h2v4H4zm4-2h2v6H8zm4-2h2v8h-2zm4-2h2v10h-2z" fill={fg}/></svg>
        <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 1.7C5.2 1.7 2.7 2.7.7 4.4l-.7-.8C2.2 1.7 5 .6 8 .6s5.8 1.1 8 3l-.7.8C13.3 2.7 10.8 1.7 8 1.7zm0 3.2c-1.7 0-3.4.6-4.6 1.7l-.7-.8C4.1 4.5 6 3.8 8 3.8s3.9.7 5.3 2l-.7.8c-1.2-1.1-2.9-1.7-4.6-1.7zm0 3.2c-1 0-1.9.3-2.6.9l-.7-.8C5.6 7.5 6.7 7.1 8 7.1s2.4.4 3.3 1.1l-.7.8c-.7-.6-1.6-.9-2.6-.9zM8 11l1.5-1.5c-.4-.4-.9-.6-1.5-.6s-1.1.2-1.5.6L8 11z" fill={fg}/></svg>
        <div style={{ width: 26, height: 12, borderRadius: 3, border: `1px solid ${fg}`, position: 'relative', opacity: 0.85 }}>
          <div style={{ position: 'absolute', inset: 1, background: fg, width: 18, borderRadius: 1.5 }} />
          <div style={{ position: 'absolute', right: -3, top: 3, width: 2, height: 6, background: fg, borderRadius: 1 }} />
        </div>
      </div>
    </div>
  );
}

function PhoneNav({ title, leading, trailing, accent = NAVY }) {
  return (
    <div style={{ padding: '6px 16px 12px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
      <div style={{ width: 36 }}>{leading}</div>
      <div style={{ flex: 1, textAlign: 'center', fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: accent, letterSpacing: 0.1 }}>{title}</div>
      <div style={{ width: 36, display: 'flex', justifyContent: 'flex-end' }}>{trailing}</div>
    </div>
  );
}

function PhoneTabBar({ active = 'shop', accent = NAVY }) {
  const tabs = [
    { id: 'shop', label: 'Shop', icon: <PIcon kind="shop" /> },
    { id: 'orders', label: 'Orders', icon: <PIcon kind="orders" /> },
    { id: 'kids', label: 'Kids', icon: <PIcon kind="kids" /> },
    { id: 'profile', label: 'Profile', icon: <PIcon kind="profile" /> },
  ];
  return (
    <div style={{ borderTop: `1px solid ${RULE}`, background: '#fff', display: 'flex', flexShrink: 0,
      padding: '8px 0 18px' }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <div key={t.id} style={{ flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, color: on ? accent : INK_DIM, padding: '6px 0' }}>
            <div style={{ opacity: on ? 1 : 0.7 }}>{t.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.3 }}>{t.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function PIcon({ kind, size = 22, color = 'currentColor' }) {
  const s = size;
  if (kind === 'shop') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8 L4 4 H20 L21 8" /><path d="M4 8 V20 H20 V8" /><path d="M9 12 a3 3 0 0 0 6 0" /></svg>;
  if (kind === 'orders') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round"><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M9 8 H15 M9 12 H15 M9 16 H13" /></svg>;
  if (kind === 'kids') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round"><circle cx="8.5" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 20 c0-3 2.5-5 5.5-5 s5.5 2 5.5 5" /><path d="M14 20 c0-2.5 2-4.5 4.5-4.5 s2.5 2 2.5 4.5" /></svg>;
  if (kind === 'profile') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21 c0-4 4-7 8-7 s8 3 8 7" /></svg>;
  if (kind === 'cart') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4 H6 L8 16 H19 L21 8 H8" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></svg>;
  if (kind === 'back') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4 L7 12 L15 20" /></svg>;
  if (kind === 'check') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13 L10 18 L20 6" /></svg>;
  if (kind === 'plus') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"><path d="M12 5 V19 M5 12 H19" /></svg>;
  if (kind === 'pickup') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6"><path d="M4 11 L12 4 L20 11 V20 H4 Z" strokeLinejoin="round" /><path d="M9 20 V14 H15 V20" /></svg>;
  if (kind === 'ship') return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="8" width="13" height="9" /><path d="M15 11 H20 L22 14 V17 H15" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>;
  return null;
}

// ─────────────────────────────────────────────────────────────
// 1. School picker — shown when parent has kids in 2+ tenant schools.
// ─────────────────────────────────────────────────────────────
function ScreenSchoolPicker() {
  const kids = [
    { name: 'Riley', year: 'Year 9',  tenant: TENANTS.nsbh },
    { name: 'Mia',   year: 'Year 7',  tenant: TENANTS.rgsh },
  ];
  return (
    <Phone bg={PARCHMENT}>
      <div style={{ padding: '24px 24px 8px', flexShrink: 0 }}>
        <PlatformMark size={26} color={NAVY} />
      </div>
      <div style={{ padding: '24px 24px 8px', flexShrink: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: GOLD }}>Welcome back</div>
        <h1 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 500, margin: '8px 0 6px', letterSpacing: -0.4, lineHeight: 1.15 }}>Good morning,<br/>George.</h1>
        <p style={{ fontSize: 14, color: INK_DIM, lineHeight: 1.5, margin: 0 }}>Whose uniform are we shopping for today?</p>
      </div>
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        {kids.map(k => (
          <div key={k.name} style={{ background: '#fff', borderRadius: 14, border: `1px solid ${RULE}`,
            padding: 18, display: 'flex', alignItems: 'center', gap: 16,
            boxShadow: '0 1px 0 rgba(15,30,50,0.04), 0 8px 24px -16px rgba(15,30,50,0.18)' }}>
            <Crest tenant={k.tenant} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: INK, lineHeight: 1.15, marginBottom: 4 }}>{k.name}</div>
              <div style={{ fontSize: 12, color: INK_DIM, lineHeight: 1.4 }}>{k.tenant.name}</div>
              <div style={{ fontSize: 11, color: INK_DIM, marginTop: 2, fontWeight: 500 }}>{k.year}</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: NAVY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M5 3 L9 7 L5 11" /></svg>
            </div>
          </div>
        ))}
        <button style={{ background: 'transparent', border: `1px dashed ${RULE}`, borderRadius: 14, padding: 16,
          fontFamily: SANS, fontSize: 13, color: INK_DIM, fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <PIcon kind="plus" size={16} /> Add another child
        </button>
      </div>
      <div style={{ padding: '0 24px 24px', fontSize: 11, color: INK_DIM, textAlign: 'center' }}>
        Switch schools any time from your profile.
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Catalog browse (per tenant, themed accent on header).
// ─────────────────────────────────────────────────────────────
function ScreenCatalog({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  const cats = ['Summer', 'Winter', 'Sports', 'Formal', 'Bags', 'Stationery'];
  const [active] = [cats[1]]; // Winter active to match Riley's order
  const items = CATALOG_NSBH;

  return (
    <Phone bg={PAPER} statusDark={true}>
      {/* Tenant-themed header strip */}
      <div style={{ background: tenant.accent, color: '#fff', padding: '4px 16px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: 4 }}>
            <Crest tenant={tenant} size={32} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600, lineHeight: 1.1 }}>{tenant.short} Uniform Shop</div>
            <div style={{ fontSize: 10.5, opacity: 0.78, marginTop: 1 }}>Shopping for · <b style={{ fontWeight: 600 }}>Riley, Year 9</b></div>
          </div>
          <div style={{ position: 'relative' }}>
            <PIcon kind="cart" size={22} />
            <div style={{ position: 'absolute', top: -4, right: -6, background: '#fff', color: tenant.accent,
              borderRadius: 10, fontSize: 10, fontWeight: 700, height: 16, minWidth: 16, padding: '0 4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>6</div>
          </div>
        </div>
      </div>
      {/* Search */}
      <div style={{ padding: '14px 16px 6px', flexShrink: 0 }}>
        <div style={{ height: 40, borderRadius: 8, border: `1px solid ${RULE}`, background: '#fff',
          display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={INK_DIM} strokeWidth="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20 L16 16" strokeLinecap="round"/></svg>
          <div style={{ fontSize: 13, color: INK_DIM }}>Search uniforms</div>
        </div>
      </div>
      {/* Category chips */}
      <div style={{ padding: '10px 16px 4px', display: 'flex', gap: 8, overflow: 'hidden', flexShrink: 0 }}>
        {cats.map(c => {
          const on = c === active;
          return (
            <div key={c} style={{ height: 30, padding: '0 12px', borderRadius: 999,
              border: `1px solid ${on ? tenant.accent : RULE}`,
              background: on ? tenant.accent : '#fff',
              color: on ? '#fff' : INK, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{c}</div>
          );
        })}
      </div>

      <div style={{ padding: '12px 16px 8px', flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 500, margin: 0 }}>Winter Uniform</h3>
        <span style={{ fontSize: 11, color: INK_DIM }}>· 6 items</span>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, padding: '0 16px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, overflow: 'hidden', alignContent: 'start' }}>
        {items.filter(i => i.cat === 'Winter').slice(0, 6).map(it => {
          const minPrice = Math.min(...it.variants.map(v => v.price));
          const maxPrice = Math.max(...it.variants.map(v => v.price));
          return (
            <div key={it.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, overflow: 'hidden' }}>
              <GarmentVector kind={it.id} accent={tenant.accent} size={120} />
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 500, lineHeight: 1.2, color: INK,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32 }}>{it.name}</div>
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: INK }}>
                  ${minPrice}{minPrice !== maxPrice && <span style={{ color: INK_DIM, fontWeight: 400 }}> – ${maxPrice}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <PhoneTabBar active="shop" accent={tenant.accent} />
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Item detail — size picker, size guide, add to cart.
// ─────────────────────────────────────────────────────────────
function ScreenItemDetail({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  const item = CATALOG_NSBH.find(i => i.id === 'jumper');
  return (
    <Phone bg={PAPER}>
      <PhoneNav title="Jumper"
        leading={<div style={{ width: 36, height: 36, borderRadius: 18, background: PARCHMENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PIcon kind="back" size={18} /></div>}
        trailing={<div style={{ position: 'relative' }}><PIcon kind="cart" size={22} color={INK} />
          <div style={{ position: 'absolute', top: -4, right: -6, background: tenant.accent, color: '#fff',
            borderRadius: 10, fontSize: 10, fontWeight: 700, height: 16, minWidth: 16, padding: '0 4px',
            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>5</div></div>}
        accent={tenant.accent} />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: PARCHMENT, padding: '4px 0 10px', display: 'flex', justifyContent: 'center' }}>
          <GarmentVector kind="jumper" accent={tenant.accent} size={210} />
        </div>
        <div style={{ padding: '18px 20px 10px' }}>
          <Chip tone="info">{item.cat} Uniform</Chip>
          <h2 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500, margin: '10px 0 6px', lineHeight: 1.2 }}>{item.name}</h2>
          <p style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.5, margin: '0 0 14px' }}>{item.desc}</p>
        </div>
        <div style={{ padding: '0 20px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
            <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: INK }}>Fit</div>
            <div style={{ fontSize: 11, color: tenant.accent, fontWeight: 600, textDecoration: 'underline' }}>Size guide</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.variants.map((v, i) => {
              const on = i === 0;
              return (
                <div key={v.label} style={{ height: 44, border: `1px solid ${on ? tenant.accent : RULE}`,
                  background: on ? '#FBF5F4' : '#fff', borderRadius: 8, padding: '0 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>{v.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: INK }}>${v.price}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding: '6px 20px 8px' }}>
          <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: INK, marginBottom: 8 }}>Size</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
            {['12','14','16','18','20','22','24'].map(s => {
              const on = s === '16';
              return (
                <div key={s} style={{ height: 42, border: `1px solid ${on ? tenant.accent : RULE}`,
                  background: on ? tenant.accent : '#fff', color: on ? '#fff' : INK,
                  borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700 }}>{s}</div>
              );
            })}
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: INK_DIM, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PIcon kind="check" size={12} color={SUCCESS} />
            <span>Riley wore size 14 last year</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 16px 24px', borderTop: `1px solid ${RULE}`, background: '#fff',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${RULE}`, borderRadius: 8, height: 44, overflow: 'hidden' }}>
          <div style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: INK }}>−</div>
          <div style={{ width: 28, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>1</div>
          <div style={{ width: 36, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: INK }}>+</div>
        </div>
        <Btn variant="primary" size="lg" fullWidth accent={tenant.accent}>Add to cart · $75</Btn>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Cart — Riley's full order from the paper form.
// ─────────────────────────────────────────────────────────────
function ScreenCart({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  const total = SAMPLE_CART.reduce((s, l) => s + l.price * l.qty, 0);
  return (
    <Phone bg={PAPER}>
      <PhoneNav title="Your Cart"
        leading={<div style={{ width: 36, height: 36, borderRadius: 18, background: PARCHMENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PIcon kind="back" size={18} /></div>}
        accent={tenant.accent} />
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ background: PARCHMENT, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Crest tenant={tenant} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: INK_DIM, lineHeight: 1.2 }}>Order for</div>
            <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600, color: INK }}>Riley · Year 9 · {tenant.short}</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: '8px 16px 0' }}>
        {SAMPLE_CART.map((line, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0',
            borderBottom: i < SAMPLE_CART.length - 1 ? `1px solid ${RULE}` : 'none' }}>
            <div style={{ width: 56, height: 56, background: PARCHMENT, borderRadius: 6, flexShrink: 0, overflow: 'hidden' }}>
              <GarmentVector kind={line.itemId} accent={tenant.accent} size={56} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: 13.5, fontWeight: 500, lineHeight: 1.25, color: INK, marginBottom: 2 }}>{line.name}</div>
              <div style={{ fontSize: 11, color: INK_DIM }}>{line.variantLabel} · Size {line.size}</div>
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${RULE}`, borderRadius: 6, height: 26 }}>
                  <div style={{ width: 24, textAlign: 'center', fontSize: 13, color: INK_DIM }}>−</div>
                  <div style={{ width: 22, textAlign: 'center', fontSize: 12, fontWeight: 700 }}>{line.qty}</div>
                  <div style={{ width: 24, textAlign: 'center', fontSize: 13, color: INK_DIM }}>+</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: INK, fontFeatureSettings: '"tnum"' }}>${line.price * line.qty}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Totals + checkout */}
      <div style={{ padding: '14px 16px 24px', borderTop: `1px solid ${RULE}`, background: '#fff', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: INK_DIM, marginBottom: 4 }}>
          <span>Subtotal · 7 items</span><span style={{ fontFeatureSettings: '"tnum"' }}>${total}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: INK_DIM, marginBottom: 8 }}>
          <span>GST included</span><span style={{ fontFeatureSettings: '"tnum"' }}>${(total / 11).toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>Total</span>
          <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, fontFeatureSettings: '"tnum"' }}>${total}</span>
        </div>
        <Btn variant="primary" size="lg" fullWidth accent={tenant.accent}>Checkout</Btn>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. Checkout — Stripe-powered payment + delivery choice.
// ─────────────────────────────────────────────────────────────
function ScreenCheckout({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  return (
    <Phone bg={PAPER}>
      <PhoneNav title="Checkout"
        leading={<div style={{ width: 36, height: 36, borderRadius: 18, background: PARCHMENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PIcon kind="back" size={18} /></div>}
        accent={tenant.accent} />
      <div style={{ flex: 1, overflow: 'hidden', padding: '4px 18px 0' }}>
        {/* Delivery */}
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: INK, marginBottom: 8 }}>Delivery method</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          <div style={{ border: `1px solid ${tenant.accent}`, background: '#FBF5F4', borderRadius: 10, padding: 12,
            display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: tenant.accent, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PIcon kind="pickup" size={18} color="#fff" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Pickup at school office</div>
              <div style={{ fontSize: 11, color: INK_DIM }}>Free · Ready in 1–2 school days</div>
            </div>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: tenant.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PIcon kind="check" size={11} color="#fff" />
            </div>
          </div>
          <div style={{ border: `1px solid ${RULE}`, borderRadius: 10, padding: 12,
            display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: PARCHMENT,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PIcon kind="ship" size={18} color={INK} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Ship to home</div>
              <div style={{ fontSize: 11, color: INK_DIM }}>$9.50 · 3–5 business days</div>
            </div>
            <div style={{ width: 18, height: 18, borderRadius: 9, border: `1.5px solid ${RULE}` }} />
          </div>
        </div>

        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: INK, marginBottom: 8 }}>Payment</div>
        <div style={{ border: `1px solid ${RULE}`, borderRadius: 10, padding: 14, background: '#fff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ height: 22, padding: '0 8px', background: '#635BFF', color: '#fff',
              borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, display: 'flex', alignItems: 'center' }}>stripe</div>
            <div style={{ fontSize: 11, color: INK_DIM }}>Secure payment · PCI-DSS</div>
          </div>
          <div style={{ height: 44, borderRadius: 6, border: `1px solid ${RULE}`, padding: '0 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
            <span style={{ color: INK, fontFeatureSettings: '"tnum"', letterSpacing: 1 }}>5240 1468 0020 4745</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <div style={{ width: 24, height: 14, background: '#EB001B', borderRadius: 1, opacity: 0.85 }} />
              <div style={{ width: 24, height: 14, background: '#F79E1B', borderRadius: 1, opacity: 0.85, marginLeft: -8 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ height: 44, borderRadius: 6, border: `1px solid ${RULE}`, padding: '0 12px',
              display: 'flex', alignItems: 'center', fontSize: 13, fontFeatureSettings: '"tnum"' }}>09 / 29</div>
            <div style={{ height: 44, borderRadius: 6, border: `1px solid ${RULE}`, padding: '0 12px',
              display: 'flex', alignItems: 'center', fontSize: 13, fontFeatureSettings: '"tnum"' }}>•••</div>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: INK_DIM }}>Saved as <b style={{ color: INK }}>•• 4745</b> · Mastercard</div>
        </div>

        <div style={{ padding: '14px 0 12px', borderTop: `1px solid ${RULE}`, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: INK_DIM, marginBottom: 4 }}>
            <span>Subtotal</span><span style={{ fontFeatureSettings: '"tnum"' }}>$363.00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: INK_DIM, marginBottom: 8 }}>
            <span>Pickup at school office</span><span>Free</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}>Total</span>
            <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, fontFeatureSettings: '"tnum"' }}>$363.00</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px 16px 24px', borderTop: `1px solid ${RULE}`, background: '#fff', flexShrink: 0 }}>
        <Btn variant="primary" size="lg" fullWidth accent={tenant.accent}
          leading={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 6 V4 a4 4 0 0 1 8 0 V6"/></svg>}>
          Pay $363.00 securely
        </Btn>
        <div style={{ textAlign: 'center', fontSize: 10.5, color: INK_DIM, marginTop: 8 }}>
          By placing this order you agree to {tenant.short}'s refund policy.
        </div>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Order placed confirmation.
// ─────────────────────────────────────────────────────────────
function ScreenOrderPlaced({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  return (
    <Phone bg={PARCHMENT}>
      <div style={{ padding: '64px 28px 16px', textAlign: 'center', flexShrink: 0 }}>
        <div style={{ width: 76, height: 76, margin: '0 auto', borderRadius: 38, background: '#fff',
          border: `2px solid ${SUCCESS}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PIcon kind="check" size={36} color={SUCCESS} />
        </div>
        <Chip tone="success" size="md" >Payment received</Chip>
        <h1 style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 500, margin: '14px 0 8px', lineHeight: 1.15, letterSpacing: -0.3 }}>
          Order placed.<br/>We'll have it ready soon.
        </h1>
        <p style={{ fontSize: 13, color: INK_DIM, lineHeight: 1.5, margin: '0 0 20px' }}>
          A receipt has been sent to <b style={{ color: INK }}>george.qiao@gmail.com</b>. You'll get another email when Riley's order is ready for pickup.
        </p>
      </div>
      <div style={{ padding: '0 20px', flex: 1 }}>
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${RULE}`,
          padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: INK_DIM, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 700 }}>Order</div>
              <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, marginTop: 2 }}>NSBH-04298</div>
            </div>
            <Crest tenant={tenant} size={40} />
          </div>
          <DoubleRule />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13 }}>
            <span style={{ color: INK_DIM }}>Pickup from</span>
            <span style={{ fontWeight: 600 }}>{tenant.short} School Office</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0 10px', fontSize: 13 }}>
            <span style={{ color: INK_DIM }}>Open</span>
            <span style={{ fontWeight: 600 }}>{tenant.shopHours}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 0 10px', fontSize: 13 }}>
            <span style={{ color: INK_DIM }}>Total paid</span>
            <span style={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>$363.00</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '20px 20px 28px', flexShrink: 0 }}>
        <Btn variant="primary" size="lg" fullWidth accent={tenant.accent}>View order details</Btn>
        <Btn variant="ghost" size="md" fullWidth style={{ marginTop: 6 }}>Back to home</Btn>
      </div>
    </Phone>
  );
}

// ─────────────────────────────────────────────────────────────
// 7. Order history & re-order.
// ─────────────────────────────────────────────────────────────
function ScreenOrders() {
  return (
    <Phone bg={PAPER}>
      <PhoneNav title="My Orders" accent={NAVY} />
      <div style={{ padding: '0 18px 6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ height: 30, padding: '0 12px', borderRadius: 999, background: NAVY, color: '#fff',
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}>All</div>
          <div style={{ height: 30, padding: '0 12px', borderRadius: 999, background: '#fff', border: `1px solid ${RULE}`, color: INK,
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}>Riley</div>
          <div style={{ height: 30, padding: '0 12px', borderRadius: 999, background: '#fff', border: `1px solid ${RULE}`, color: INK,
            fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}>Mia</div>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', padding: '14px 18px 0' }}>
        {/* Active order */}
        <div style={{ background: '#fff', border: `1px solid ${RULE}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Crest tenant={TENANTS.nsbh} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>NSBH · Riley</div>
              <div style={{ fontSize: 10.5, color: INK_DIM }}>Placed 27 Apr · 9:42am</div>
            </div>
            <Chip tone="warn">Packing</Chip>
          </div>
          {/* Status track */}
          <div style={{ position: 'relative', padding: '6px 4px 4px' }}>
            <div style={{ position: 'absolute', left: 12, right: 12, top: 14, height: 2, background: RULE }} />
            <div style={{ position: 'absolute', left: 12, width: '38%', top: 14, height: 2, background: TENANTS.nsbh.accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              {['Placed','Packed','Ready','Collected'].map((s, i) => {
                const done = i <= 1;
                const cur = i === 1;
                return (
                  <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 8,
                      background: done ? TENANTS.nsbh.accent : '#fff',
                      border: `2px solid ${done ? TENANTS.nsbh.accent : RULE}`,
                      boxShadow: cur ? `0 0 0 4px rgba(122,31,43,0.12)` : 'none' }} />
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: done ? INK : INK_DIM, letterSpacing: 0.3 }}>{s}</div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ marginTop: 10, padding: 10, background: PARCHMENT, borderRadius: 6, fontSize: 11.5, color: INK_DIM, lineHeight: 1.5 }}>
            6 items · $363.00 · We'll email you when it's ready for pickup at the {TENANTS.nsbh.short} office.
          </div>
        </div>

        {/* Past orders */}
        <div style={{ fontFamily: SANS, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: INK_DIM, marginBottom: 8 }}>Past orders</div>
        {PAST_ORDERS.map((o, i) => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
            borderBottom: i < PAST_ORDERS.length - 1 ? `1px solid ${RULE}` : 'none' }}>
            <Crest tenant={TENANTS[o.school]} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{o.kid} · {o.items} items</div>
              <div style={{ fontSize: 10.5, color: INK_DIM }}>{o.date} · {o.id}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, fontFeatureSettings: '"tnum"' }}>${o.total}</div>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: TENANTS[o.school].accent, textDecoration: 'underline' }}>Re-order</div>
            </div>
          </div>
        ))}
      </div>
      <PhoneTabBar active="orders" />
    </Phone>
  );
}

Object.assign(window, {
  ScreenSchoolPicker, ScreenCatalog, ScreenItemDetail,
  ScreenCart, ScreenCheckout, ScreenOrderPlaced, ScreenOrders,
  PHONE_W, PHONE_H,
});
