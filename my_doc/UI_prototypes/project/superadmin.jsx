// superadmin.jsx — Platform super-admin (UniformOrder ops). Manages tenants
// across the platform: list, provision a new school, billing.

function PlatformShell({ active = 'tenants', children }) {
  const nav = [
    { id: 'tenants', label: 'Tenants', icon: 'team' },
    { id: 'billing', label: 'Billing', icon: 'chart' },
    { id: 'support', label: 'Support', icon: 'mail' },
    { id: 'system',  label: 'System',  icon: 'settings' },
  ];
  return (
    <div style={{ width: ADMIN_W, height: ADMIN_H, background: PARCHMENT, fontFamily: SANS,
      color: INK, display: 'flex', overflow: 'hidden' }}>
      <div style={{ width: 220, background: '#0A1726', color: '#E8E0CF', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <PlatformMark size={22} color="#fff" />
          <div style={{ fontSize: 10.5, color: '#A3B0C2', marginTop: 6, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>Platform Console</div>
        </div>
        <div style={{ padding: '14px 8px', flex: 1 }}>
          {nav.map(n => {
            const on = n.id === active;
            return (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', margin: '2px 0', borderRadius: 6,
                background: on ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: on ? '#fff' : '#B6C0CE', fontSize: 13, fontWeight: on ? 600 : 500 }}>
                <AdminIcon kind={n.icon} size={16} color={on ? '#fff' : '#8997A8'} />
                <span>{n.label}</span>
              </div>
            );
          })}
        </div>
        <div style={{ padding: 12, borderTop: `1px solid rgba(255,255,255,0.08)`,
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: GOLD, color: NAVY_DEEP,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>JM</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Jane Mercer</div>
            <div style={{ fontSize: 10.5, color: '#A3B0C2' }}>Platform admin</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

// Super-admin 1 — Tenant list.
function ScreenPlatformTenants() {
  const total = PLATFORM_TENANTS.length;
  const active = PLATFORM_TENANTS.filter(t => t.status === 'active').length;
  return (
    <PlatformShell active="tenants">
      <AdminTopbar kicker="UniformOrder Platform" title="Tenant schools"
        right={<>
          <Btn variant="secondary" size="sm" leading={<AdminIcon kind="download" size={14}/>}>Export CSV</Btn>
          <Btn variant="primary" size="sm" leading={<AdminIcon kind="plus" size={14} color="#fff"/>}>Provision new tenant</Btn>
        </>} />
      <div style={{ flex: 1, padding: 28, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          {[
            { l: 'Tenants', v: total, sub: `${active} active · 1 trial · 1 pending` },
            { l: 'Parents',  v: '4,890', sub: 'Across all schools' },
            { l: 'Orders · 30d', v: '1,145', sub: '+18% vs prior period' },
            { l: 'Stripe payouts · 30d', v: '$72,640', sub: 'Net of platform fees' },
          ].map(s => (
            <div key={s.l} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: INK_DIM, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.l}</div>
              <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, marginTop: 6, fontFeatureSettings: '"tnum"' }}>{s.v}</div>
              <div style={{ fontSize: 11, color: INK_DIM, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${RULE}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['All', 'Active', 'Trial', 'Pending'].map((c, i) => (
                <div key={c} style={{ height: 28, padding: '0 12px', borderRadius: 6,
                  background: i === 0 ? NAVY : 'transparent', color: i === 0 ? '#fff' : INK_DIM,
                  fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}>{c}</div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ height: 32, border: `1px solid ${RULE}`, borderRadius: 6, padding: '0 10px',
              display: 'flex', alignItems: 'center', gap: 8, width: 240 }}>
              <AdminIcon kind="search" size={14} color={INK_DIM} />
              <span style={{ fontSize: 12, color: INK_DIM }}>Search by name or domain</span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: PARCHMENT }}>
                {['School', 'Plan', 'Parents', 'Orders · 30d', 'Since', 'Status', ''].map((h, i) => (
                  <th key={h} style={{ textAlign: i === 6 ? 'right' : i >= 2 && i <= 3 ? 'right' : 'left',
                    padding: '10px 16px', fontSize: 10.5, fontWeight: 700, color: INK_DIM,
                    letterSpacing: 0.6, textTransform: 'uppercase', borderBottom: `1px solid ${RULE}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLATFORM_TENANTS.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: i < PLATFORM_TENANTS.length - 1 ? `1px solid ${RULE}` : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Crest tenant={{ id: t.id, short: t.short, accent: t.accent }} size={36} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5, fontFamily: SERIF }}>{t.name}</div>
                        <div style={{ fontFamily: MONO, fontSize: 10.5, color: INK_DIM, marginTop: 2 }}>{t.id}.uniformorder.com.au</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.plan === 'Trial'
                      ? <Chip tone="warn" size="sm">Trial</Chip>
                      : <Chip tone="neutral" size="sm">Standard</Chip>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{t.parents.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{t.orders30d}</td>
                  <td style={{ padding: '12px 16px', color: INK_DIM }}>{t.since}</td>
                  <td style={{ padding: '12px 16px' }}>
                    {t.status === 'active' && <Chip tone="success" size="sm">Active</Chip>}
                    {t.status === 'trial' && <Chip tone="warn" size="sm">In trial · 12d left</Chip>}
                    {t.status === 'pending' && <Chip tone="info" size="sm">Provisioning</Chip>}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <span style={{ fontSize: 12, color: NAVY, fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>Open →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PlatformShell>
  );
}

// Super-admin 2 — Provision a new tenant (multi-step form, step 2 shown).
function ScreenProvisionTenant() {
  return (
    <PlatformShell active="tenants">
      <AdminTopbar kicker="Provision tenant" title="New school onboarding"
        right={<><Btn variant="ghost" size="sm">Save draft</Btn>
          <Btn variant="primary" size="sm">Continue · Billing</Btn></>} />
      <div style={{ flex: 1, padding: 28, overflow: 'hidden', display: 'grid', gridTemplateColumns: '260px 1fr 360px', gap: 22 }}>
        {/* Step rail */}
        <div>
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, padding: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: INK_DIM, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Onboarding</div>
            {[
              { n: 1, l: 'School identity', s: 'done' },
              { n: 2, l: 'Branding',        s: 'current' },
              { n: 3, l: 'Billing & Stripe', s: 'todo' },
              { n: 4, l: 'Shop operator',   s: 'todo' },
              { n: 5, l: 'Catalog import',  s: 'todo' },
              { n: 6, l: 'Go live',         s: 'todo' },
            ].map((st, i, a) => (
              <div key={st.n} style={{ position: 'relative', padding: '10px 0', display: 'flex', gap: 12 }}>
                {i < a.length - 1 && (
                  <div style={{ position: 'absolute', left: 13, top: 30, bottom: -8, width: 1.5,
                    background: st.s === 'done' ? NAVY : RULE }} />
                )}
                <div style={{ width: 26, height: 26, borderRadius: 13, flexShrink: 0,
                  background: st.s === 'done' ? NAVY : st.s === 'current' ? '#fff' : '#fff',
                  border: `2px solid ${st.s === 'todo' ? RULE : NAVY}`,
                  color: st.s === 'done' ? '#fff' : NAVY,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, position: 'relative', zIndex: 1 }}>
                  {st.s === 'done' ? <AdminIcon kind="check" size={12} color="#fff" /> : st.n}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: st.s === 'todo' ? INK_DIM : INK }}>{st.l}</div>
                  {st.s === 'current' && <div style={{ fontSize: 11, color: INK_DIM, marginTop: 1 }}>You are here</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Form */}
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, padding: 28, overflow: 'hidden' }}>
          <SectionTitle kicker="Step 2 of 6" title="Branding"
            sub="Each school has its own logo + accent color. The platform stays navy + serif underneath." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 4 }}>
            <Field label="Display name" value="Manly Beach Grammar School" />
            <Field label="Short code" value="MBGS" hint="Used as subdomain · mbgs.uniformorder.com.au" />
            <Field label="Motto (optional)" value="Per mare per terras" />
            <Field label="Year levels" value="K – Year 12" />
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: INK, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>School crest / logo</div>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ width: 96, height: 96, background: PARCHMENT, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Crest tenant={{ id: 'mbgs', short: 'MBGS', accent: '#0F4C5C' }} size={72} />
              </div>
              <div style={{ flex: 1, border: `1.5px dashed ${RULE}`, borderRadius: 10,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 16, gap: 6 }}>
                <AdminIcon kind="upload" size={20} color={INK_DIM} />
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>Drop SVG or PNG (≥ 512px)</div>
                <div style={{ fontSize: 11, color: INK_DIM }}>or browse files</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: INK, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>Accent color</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {['#0F4C5C', '#7A1F2B', '#2F5D50', '#1F3A6E', '#4A2238', '#7A5418', '#0E2A47'].map((c, i) => (
                <div key={c} style={{ width: 44, height: 44, borderRadius: 22, background: c,
                  border: i === 0 ? `3px solid ${INK}` : `1px solid ${RULE}`,
                  outline: i === 0 ? `2px solid #fff` : 'none', outlineOffset: i === 0 ? -3 : 0,
                  position: 'relative' }}>
                  {i === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <AdminIcon kind="check" size={18} color="#fff" /></div>}
                </div>
              ))}
              <div style={{ width: 44, height: 44, borderRadius: 22, border: `1px dashed ${RULE}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: INK_DIM, fontSize: 18 }}>+</div>
            </div>
            <div style={{ fontSize: 11, color: INK_DIM, marginTop: 8 }}>Used on parent buttons, headers, and order tracking. Platform chrome stays navy.</div>
          </div>
        </div>
        {/* Live preview */}
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, padding: 18, overflow: 'hidden' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: INK_DIM, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 12 }}>Live preview · Parent</div>
          <div style={{ borderRadius: 22, border: `8px solid ${INK}`, overflow: 'hidden',
            background: '#fff', transform: 'scale(0.85)', transformOrigin: 'top left', width: 280, height: 540,
            position: 'relative' }}>
            <div style={{ background: '#0F4C5C', padding: '20px 16px 16px', color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Crest tenant={{ id: 'mbgs', short: 'MBGS', accent: '#0F4C5C' }} size={32} />
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600 }}>MBGS Uniform Shop</div>
                  <div style={{ fontSize: 10.5, opacity: 0.78 }}>Your order, ready in days</div>
                </div>
              </div>
            </div>
            <div style={{ padding: 14 }}>
              <div style={{ height: 30, padding: '0 12px', background: '#0F4C5C', color: '#fff',
                borderRadius: 999, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>Winter Uniform</div>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {['shirt-ls', 'jumper'].map(k => (
                  <div key={k} style={{ background: '#fff', border: `1px solid ${RULE}`, borderRadius: 8, overflow: 'hidden' }}>
                    <GarmentVector kind={k} accent="#0F4C5C" size={120} />
                  </div>
                ))}
              </div>
              <Btn variant="primary" size="md" fullWidth accent="#0F4C5C" style={{ marginTop: 14 }}>Add to cart</Btn>
            </div>
          </div>
          <div style={{ marginTop: -100, fontSize: 11, color: INK_DIM, textAlign: 'center', paddingTop: 4 }}>
            Updates as you change branding.
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}

function Field({ label, value, hint }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: INK, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ height: 40, border: `1px solid ${RULE}`, borderRadius: 6, padding: '0 12px',
        display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 500, background: '#fff' }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: INK_DIM, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

Object.assign(window, { ScreenPlatformTenants, ScreenProvisionTenant });
