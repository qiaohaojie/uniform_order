// operator.jsx — School operator admin screens. Tablet/desktop sized
// (1280x900). Sidebar nav; navy + serif title styling matches parent.

const ADMIN_W = 1280;
const ADMIN_H = 900;

function AdminShell({ tenantId = 'nsbh', active = 'dashboard', children }) {
  const tenant = TENANTS[tenantId];
  const nav = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home' },
    { id: 'orders',    label: 'Orders',    icon: 'orders', badge: '7 new' },
    { id: 'catalog',   label: 'Catalog',   icon: 'catalog' },
    { id: 'upload',    label: 'Bulk upload', icon: 'upload' },
    { id: 'shipping',  label: 'Pickup & shipping', icon: 'pickup' },
    { id: 'reports',   label: 'Reports',   icon: 'chart' },
    { id: 'team',      label: 'Team',      icon: 'team' },
    { id: 'settings',  label: 'Settings',  icon: 'settings' },
  ];
  return (
    <div style={{ width: ADMIN_W, height: ADMIN_H, background: PARCHMENT, fontFamily: SANS,
      color: INK, display: 'flex', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: 240, background: NAVY_DEEP, color: '#E8E0CF', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <PlatformMark size={22} color="#fff" />
        </div>
        <div style={{ padding: '12px 12px', borderBottom: `1px solid rgba(255,255,255,0.08)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 8,
            background: 'rgba(255,255,255,0.04)' }}>
            <Crest tenant={tenant} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tenant.short}</div>
              <div style={{ fontSize: 10.5, color: '#A3B0C2' }}>Uniform Shop</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#A3B0C2" strokeWidth="1.6"><path d="M3 5 L7 9 L11 5"/></svg>
          </div>
        </div>
        <div style={{ padding: '14px 8px', flex: 1 }}>
          {nav.map(n => {
            const on = n.id === active;
            return (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', margin: '2px 0', borderRadius: 6, cursor: 'pointer',
                background: on ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: on ? '#fff' : '#B6C0CE', fontSize: 13, fontWeight: on ? 600 : 500 }}>
                <AdminIcon kind={n.icon} size={16} color={on ? '#fff' : '#8997A8'} />
                <span style={{ flex: 1 }}>{n.label}</span>
                {n.badge && <span style={{ fontSize: 10, fontWeight: 700, color: GOLD,
                  background: 'rgba(176,138,62,0.15)', borderRadius: 999, padding: '2px 7px' }}>{n.badge}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ padding: 12, borderTop: `1px solid rgba(255,255,255,0.08)`,
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: GOLD, color: NAVY_DEEP,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>SK</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>Sarah Knight</div>
            <div style={{ fontSize: 10.5, color: '#A3B0C2' }}>Shop manager</div>
          </div>
        </div>
      </div>
      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function AdminIcon({ kind, size = 16, color = 'currentColor' }) {
  const s = size, p = { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'home') return <svg {...p}><path d="M4 11 L12 4 L20 11 V20 H4 Z"/></svg>;
  if (kind === 'orders') return <svg {...p}><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 8 H15 M9 12 H15 M9 16 H13"/></svg>;
  if (kind === 'catalog') return <svg {...p}><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></svg>;
  if (kind === 'upload') return <svg {...p}><path d="M12 3 V15 M7 8 L12 3 L17 8"/><path d="M4 17 V20 H20 V17"/></svg>;
  if (kind === 'pickup') return <svg {...p}><path d="M4 11 L12 4 L20 11 V20 H4 Z"/><path d="M9 20 V14 H15 V20"/></svg>;
  if (kind === 'chart') return <svg {...p}><path d="M4 20 V4"/><path d="M4 20 H20"/><path d="M8 16 L12 11 L15 13 L20 7"/></svg>;
  if (kind === 'team') return <svg {...p}><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 19 c0-3 2.5-5 6-5 s6 2 6 5"/><path d="M15 19 c0-2 2-3 4-3 s2 1 2 3"/></svg>;
  if (kind === 'settings') return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M5 5 L7 7 M17 17 L19 19 M5 19 L7 17 M17 7 L19 5"/></svg>;
  if (kind === 'plus') return <svg {...p}><path d="M12 5 V19 M5 12 H19"/></svg>;
  if (kind === 'search') return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20 L16 16"/></svg>;
  if (kind === 'download') return <svg {...p}><path d="M12 4 V16 M7 11 L12 16 L17 11"/><path d="M4 19 V20 H20 V19"/></svg>;
  if (kind === 'print') return <svg {...p}><rect x="6" y="3" width="12" height="6"/><rect x="3" y="9" width="18" height="9" rx="1"/><rect x="6" y="15" width="12" height="6"/></svg>;
  if (kind === 'edit') return <svg {...p}><path d="M4 20 H8 L20 8 L16 4 L4 16 Z"/></svg>;
  if (kind === 'mail') return <svg {...p}><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 7 L12 13 L21 7"/></svg>;
  if (kind === 'check') return <svg {...p}><path d="M5 13 L10 18 L20 6"/></svg>;
  if (kind === 'x') return <svg {...p}><path d="M6 6 L18 18 M18 6 L6 18"/></svg>;
  if (kind === 'warn') return <svg {...p}><path d="M12 3 L22 20 H2 Z"/><path d="M12 10 V14"/><circle cx="12" cy="17" r="0.6" fill={color} stroke="none"/></svg>;
  return null;
}

function AdminTopbar({ title, kicker, right, accent = NAVY }) {
  return (
    <div style={{ height: 68, padding: '0 28px', display: 'flex', alignItems: 'center', gap: 16,
      background: '#fff', borderBottom: `1px solid ${RULE}`, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {kicker && <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: INK_DIM }}>{kicker}</div>}
        <h1 style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 500, margin: '2px 0 0', letterSpacing: -0.2 }}>{title}</h1>
      </div>
      {right}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Operator 1 — Dashboard / sales overview.
// ─────────────────────────────────────────────────────────────
function ScreenAdminDashboard({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  const stats = [
    { label: 'Revenue · 30d', value: '$18,420', delta: '+12.4%', tone: 'pos', spark: SALES.spark },
    { label: 'Orders · 30d',  value: '312',     delta: '+8.1%',  tone: 'pos' },
    { label: 'Avg order',     value: '$59.04',  delta: '+1.2%',  tone: 'pos' },
    { label: 'Awaiting pickup', value: '24',    delta: '3 over 7d', tone: 'warn' },
  ];
  return (
    <AdminShell tenantId={tenantId} active="dashboard">
      <AdminTopbar kicker={`${tenant.short} · Operator`} title="Dashboard"
        right={<><Btn variant="secondary" size="sm" leading={<AdminIcon kind="download" size={14}/>}>Export</Btn>
          <Btn variant="primary" size="sm" accent={tenant.accent} leading={<AdminIcon kind="plus" size={14} color="#fff"/>}>New product</Btn></>} />
      <div style={{ flex: 1, padding: 28, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
          {stats.map(s => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: INK_DIM, letterSpacing: 0.4, textTransform: 'uppercase' }}>{s.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 8 }}>
                <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, fontFeatureSettings: '"tnum"', letterSpacing: -0.4 }}>{s.value}</div>
                {s.spark && <Spark data={s.spark} w={80} h={28} color={tenant.accent} />}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600,
                color: s.tone === 'pos' ? SUCCESS : s.tone === 'warn' ? '#7A5418' : INK_DIM, marginTop: 6 }}>{s.delta}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
              <h3 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, margin: 0 }}>Top selling items</h3>
              <span style={{ fontSize: 11, color: INK_DIM }}>Last 30 days</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: INK_DIM, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>Item</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>Qty</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>Revenue</th>
                  <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}`, width: 120 }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {SALES.topItems.map((r, i) => {
                  const pct = (r.revenue / SALES.revenue) * 100;
                  return (
                    <tr key={r.name} style={{ borderBottom: i < SALES.topItems.length - 1 ? `1px solid ${RULE}` : 'none' }}>
                      <td style={{ padding: '12px 0', fontWeight: 500 }}>{r.name}</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontFeatureSettings: '"tnum"' }}>{r.qty}</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600, fontFeatureSettings: '"tnum"' }}>${r.revenue.toLocaleString()}</td>
                      <td style={{ padding: '12px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                          <div style={{ width: 60, height: 6, background: PARCHMENT, borderRadius: 3 }}>
                            <div style={{ width: `${pct}%`, height: 6, background: tenant.accent, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, color: INK_DIM, width: 32, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`, padding: 18 }}>
            <h3 style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 500, margin: '0 0 12px' }}>Needs attention</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 10, padding: 10, background: '#FBF1E5', border: `1px solid #E5D5AE`, borderRadius: 6 }}>
                <AdminIcon kind="warn" size={18} color="#7A5418" />
                <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5 }}>
                  <b>3 orders</b> ready for pickup over 7 days. <a style={{ color: tenant.accent, fontWeight: 600 }}>Send reminder →</a>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, padding: 10, background: '#E2EAF3', border: `1px solid #C7D4E3`, borderRadius: 6 }}>
                <AdminIcon kind="mail" size={18} color={NAVY_SOFT} />
                <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5 }}>
                  <b>Term 2 catalog</b> uploaded by Sarah. 4 items with errors. <a style={{ color: tenant.accent, fontWeight: 600 }}>Review →</a>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, padding: 10, background: '#E5F0E7', border: `1px solid #C6DECB`, borderRadius: 6 }}>
                <AdminIcon kind="check" size={18} color={SUCCESS} />
                <div style={{ flex: 1, fontSize: 12, lineHeight: 1.5 }}>
                  Stripe payouts on track. Next deposit <b>Wed 29 Apr · $4,820</b>.
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, padding: '14px 0 0', borderTop: `1px solid ${RULE}` }}>
              <div style={{ fontSize: 11, color: INK_DIM, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 }}>Recent activity</div>
              <div style={{ fontSize: 12, color: INK, lineHeight: 1.7 }}>
                <div>· Order <b>NSBH-04298</b> placed · 9:42am</div>
                <div>· <b>Lin Chen</b> requested ship-to-home · 8:01am</div>
                <div>· <b>Sarah Knight</b> printed 12 pick slips · yesterday</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Operator 2 — Order queue (Kanban-ish columns by status).
// ─────────────────────────────────────────────────────────────
function ScreenAdminOrders({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  const cols = [
    { id: 'new',     label: 'New',           tone: NAVY },
    { id: 'packing', label: 'Packing',       tone: '#7A5418' },
    { id: 'ready',   label: 'Ready for pickup', tone: tenant.accent },
    { id: 'collected', label: 'Collected',   tone: SUCCESS },
  ];
  const counts = cols.reduce((a, c) => ({ ...a, [c.id]: ADMIN_ORDERS.filter(o => o.status === c.id).length }), {});
  return (
    <AdminShell tenantId={tenantId} active="orders">
      <AdminTopbar kicker={`${tenant.short} · Operator`} title="Orders"
        right={<>
          <div style={{ height: 36, border: `1px solid ${RULE}`, borderRadius: 6, padding: '0 10px',
            display: 'flex', alignItems: 'center', gap: 8, background: '#fff', width: 240 }}>
            <AdminIcon kind="search" size={14} color={INK_DIM} />
            <input placeholder="Search by order, parent, or kid" style={{ border: 'none', outline: 'none', flex: 1, fontSize: 12.5, fontFamily: SANS, color: INK, background: 'transparent' }} readOnly />
          </div>
          <Btn variant="secondary" size="sm" leading={<AdminIcon kind="print" size={14}/>}>Print pick slips</Btn>
          <Btn variant="primary" size="sm" accent={tenant.accent} leading={<AdminIcon kind="mail" size={14} color="#fff"/>}>Email parents</Btn>
        </>} />

      <div style={{ flex: 1, padding: 24, overflow: 'hidden', display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {cols.map(col => (
          <div key={col.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`,
            display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${RULE}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: col.tone }} />
                <div style={{ fontSize: 12.5, fontWeight: 700, color: INK }}>{col.label}</div>
                <div style={{ fontSize: 11, color: INK_DIM, fontWeight: 600 }}>{counts[col.id]}</div>
              </div>
            </div>
            <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
              {ADMIN_ORDERS.filter(o => o.status === col.id).slice(0, 4).map(o => (
                <div key={o.id} style={{ background: PAPER, border: `1px solid ${RULE}`, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: tenant.accent }}>{o.id}</div>
                    {o.delivery === 'ship'
                      ? <Chip tone="info" size="sm">Ship</Chip>
                      : <Chip tone="neutral" size="sm">Pickup</Chip>}
                  </div>
                  <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 500, lineHeight: 1.2, marginBottom: 2 }}>{o.kid}</div>
                  <div style={{ fontSize: 11, color: INK_DIM }}>{o.parent} · {o.year}</div>
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${RULE}`,
                    display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: INK_DIM }}>{o.items} items</span>
                    <span style={{ fontWeight: 700, fontFeatureSettings: '"tnum"' }}>${o.total}</span>
                  </div>
                  {col.id === 'new' && (
                    <Btn variant="secondary" size="sm" fullWidth style={{ marginTop: 8 }}>Start packing</Btn>
                  )}
                  {col.id === 'packing' && (
                    <Btn variant="primary" size="sm" fullWidth accent={tenant.accent} style={{ marginTop: 8 }}>Mark ready</Btn>
                  )}
                  {col.id === 'ready' && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <Btn variant="secondary" size="sm" style={{ flex: 1 }}>Notify</Btn>
                      <Btn variant="primary" size="sm" accent={SUCCESS} style={{ flex: 1 }}>Collect</Btn>
                    </div>
                  )}
                </div>
              ))}
              {counts[col.id] > 4 && (
                <div style={{ fontSize: 11, fontWeight: 600, color: tenant.accent, textAlign: 'center', padding: 6 }}>
                  + {counts[col.id] - 4} more
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Operator 3 — Catalog table (CRUD list view).
// ─────────────────────────────────────────────────────────────
function ScreenAdminCatalog({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  return (
    <AdminShell tenantId={tenantId} active="catalog">
      <AdminTopbar kicker={`${tenant.short} · Operator`} title="Catalog"
        right={<>
          <Btn variant="secondary" size="sm" leading={<AdminIcon kind="upload" size={14}/>}>Bulk upload CSV</Btn>
          <Btn variant="primary" size="sm" accent={tenant.accent} leading={<AdminIcon kind="plus" size={14} color="#fff"/>}>Add product</Btn>
        </>} />
      <div style={{ flex: 1, padding: 24, overflow: 'hidden' }}>
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${RULE}`,
          display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${RULE}`,
            display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['All', 'Summer', 'Winter', 'Sports', 'Formal', 'Bags', 'Stationery'].map((c, i) => (
                <div key={c} style={{ height: 28, padding: '0 12px', borderRadius: 6,
                  background: i === 0 ? NAVY : 'transparent', color: i === 0 ? '#fff' : INK_DIM,
                  fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center' }}>{c}</div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 11.5, color: INK_DIM }}>{CATALOG_NSBH.length} products · 32 variants</div>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: PARCHMENT }}>
                  {['Product', 'Category', 'Variants', 'Price range', 'Updated', ''].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 5 || i === 3 ? 'right' : 'left',
                      padding: '10px 16px', fontSize: 10.5, fontWeight: 700, color: INK_DIM,
                      letterSpacing: 0.6, textTransform: 'uppercase', borderBottom: `1px solid ${RULE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CATALOG_NSBH.slice(0, 11).map(it => {
                  const min = Math.min(...it.variants.map(v => v.price));
                  const max = Math.max(...it.variants.map(v => v.price));
                  const variants = it.variants.reduce((s, v) => s + v.sizes.length, 0);
                  return (
                    <tr key={it.id} style={{ borderBottom: `1px solid ${RULE}` }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 40, height: 40, background: PARCHMENT, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                            <GarmentVector kind={it.id} accent={tenant.accent} size={40} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>{it.name}</div>
                            <div style={{ fontFamily: MONO, fontSize: 10.5, color: INK_DIM, marginTop: 2 }}>SKU-{it.id.toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px' }}><Chip tone="neutral" size="sm">{it.cat}</Chip></td>
                      <td style={{ padding: '10px 16px', color: INK_DIM, fontFeatureSettings: '"tnum"' }}>{variants} sizes</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFeatureSettings: '"tnum"', fontWeight: 600 }}>
                        ${min}{min !== max && ` – $${max}`}
                      </td>
                      <td style={{ padding: '10px 16px', color: INK_DIM, fontSize: 11.5 }}>22 Apr</td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          <span style={{ width: 28, height: 28, border: `1px solid ${RULE}`, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <AdminIcon kind="edit" size={13} color={INK_DIM} />
                          </span>
                          <span style={{ width: 28, height: 28, border: `1px solid ${RULE}`, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>⋯</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Operator 4 — Bulk upload (CSV preview + inline error highlights).
// ─────────────────────────────────────────────────────────────
function ScreenAdminUpload({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  // Mocked rows from "term2-catalog.csv" — 2 errors deliberately seeded.
  const rows = [
    { i: 1, sku: 'SHIRT-SS', name: 'White Shirt — Short Sleeves', cat: 'Summer',  variant: 'Boys 10–26', sizes: '10,12,14,16,18,20,22,24,26', price: '32.00', status: 'add' },
    { i: 2, sku: 'SHIRT-SS', name: 'White Shirt — Short Sleeves', cat: 'Summer',  variant: 'Mens 4–8',   sizes: '4,5,6,7,8', price: '43.00', status: 'add' },
    { i: 3, sku: 'JUMPER',   name: 'Jumper — Wool Blend, Crested', cat: 'Winter', variant: '12–16',      sizes: '12,14,16',  price: '75.00', status: 'update' },
    { i: 4, sku: 'JUMPER',   name: 'Jumper — Wool Blend, Crested', cat: 'Winter', variant: '18–22',      sizes: '18,20,22',  price: '77.00', status: 'update' },
    { i: 5, sku: 'TRACKS',   name: 'Track Pants',                   cat: 'Sports', variant: '12–16',     sizes: '12,14,16',  price: '43.00', status: 'add' },
    { i: 6, sku: 'TRACKS',   name: 'Track Pants',                   cat: 'Sports', variant: '18–26',     sizes: '18,20,22,24,26', price: 'free',  status: 'error', errs: { price: 'Must be a number' } },
    { i: 7, sku: 'BLAZER',   name: 'Blazer — Crested',              cat: 'Formal', variant: '88–95cm chest', sizes: '88,92,95', price: '185.00', status: 'add' },
    { i: 8, sku: 'BLAZER',   name: 'Blazer — Crested',              cat: 'Formal', variant: '100–115cm chest', sizes: '100,105,110,115', price: '210.00', status: 'add' },
    { i: 9, sku: '',         name: 'Prefect Tie',                   cat: 'Formal', variant: '147cm',     sizes: 'OS',        price: '22.00', status: 'error', errs: { sku: 'SKU required' } },
    { i: 10, sku: 'POLO',    name: 'Sports Polo Shirt',             cat: 'Sports', variant: '10–26',     sizes: '10,12,14,16,18,20,22,24,26', price: '40.00', status: 'add' },
    { i: 11, sku: 'HOODIE',  name: 'Navy Hoodie',                   cat: 'Sports', variant: '12–XXL',    sizes: '12,14,16,18,20,L,XL,XXL', price: '47.00', status: 'add' },
  ];
  const errs = rows.filter(r => r.status === 'error').length;
  const adds = rows.filter(r => r.status === 'add').length;
  const upds = rows.filter(r => r.status === 'update').length;

  return (
    <AdminShell tenantId={tenantId} active="upload">
      <AdminTopbar kicker={`${tenant.short} · Operator`} title="Bulk upload"
        right={<><Btn variant="ghost" size="sm">Cancel</Btn>
          <Btn variant="secondary" size="sm">Download template</Btn>
          <Btn variant="primary" size="sm" accent={tenant.accent} disabled={errs > 0}>Import {rows.length - errs} rows</Btn></>} />
      <div style={{ flex: 1, padding: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: INK_DIM }}>
          <span style={{ width: 22, height: 22, borderRadius: 11, background: SUCCESS, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
            <AdminIcon kind="check" size={11} color="#fff" /></span>
          <span style={{ color: INK, fontWeight: 600 }}>Upload</span>
          <span style={{ width: 24, height: 1, background: RULE }} />
          <span style={{ width: 22, height: 22, borderRadius: 11, background: NAVY, color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>2</span>
          <span style={{ color: INK, fontWeight: 600 }}>Review &amp; fix errors</span>
          <span style={{ width: 24, height: 1, background: RULE }} />
          <span style={{ width: 22, height: 22, borderRadius: 11, background: '#fff', border: `1px solid ${RULE}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: INK_DIM }}>3</span>
          <span>Confirm import</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: MONO, fontSize: 11, color: INK_DIM }}>term2-catalog.csv · 11 rows · uploaded 9:41am</span>
        </div>
        {/* Banner */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, background: '#FBE6E1', border: `1px solid #E5BDB4`, borderRadius: 8, padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 18, background: ALERT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AdminIcon kind="warn" size={18} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{errs} rows have errors</div>
              <div style={{ fontSize: 12, color: INK_DIM }}>Fix or skip them before importing. Edit cells inline below.</div>
            </div>
          </div>
          <div style={{ width: 200, background: '#fff', border: `1px solid ${RULE}`, borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: INK_DIM, letterSpacing: 0.4, textTransform: 'uppercase' }}>Summary</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12 }}>
              <span><b style={{ fontFamily: SERIF, fontSize: 16 }}>{adds}</b> add</span>
              <span><b style={{ fontFamily: SERIF, fontSize: 16 }}>{upds}</b> update</span>
              <span style={{ color: ALERT }}><b style={{ fontFamily: SERIF, fontSize: 16 }}>{errs}</b> error</span>
            </div>
          </div>
        </div>

        {/* Preview table */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 8, border: `1px solid ${RULE}`,
          overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, fontFamily: SANS }}>
              <thead>
                <tr style={{ background: PARCHMENT }}>
                  {['#', 'SKU', 'Product', 'Cat', 'Variant', 'Sizes', 'Price', 'Action'].map((h, i) => (
                    <th key={h} style={{ textAlign: i === 6 ? 'right' : 'left', padding: '10px 12px',
                      fontSize: 10.5, fontWeight: 700, color: INK_DIM, letterSpacing: 0.6,
                      textTransform: 'uppercase', borderBottom: `1px solid ${RULE}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const bad = r.status === 'error';
                  return (
                    <tr key={r.i} style={{ borderBottom: `1px solid ${RULE}`, background: bad ? '#FDF1ED' : '#fff' }}>
                      <td style={{ padding: '10px 12px', color: INK_DIM, fontFamily: MONO, width: 30 }}>{r.i}</td>
                      <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 11.5, fontWeight: 600 }}>
                        {r.errs?.sku ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: ALERT }}>
                            <span style={{ borderBottom: `2px wavy ${ALERT}`, paddingBottom: 1 }}>(empty)</span>
                          </span>
                        ) : r.sku}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 500 }}>{r.name}</td>
                      <td style={{ padding: '10px 12px' }}><Chip tone="neutral" size="sm">{r.cat}</Chip></td>
                      <td style={{ padding: '10px 12px', color: INK_DIM }}>{r.variant}</td>
                      <td style={{ padding: '10px 12px', fontFamily: MONO, fontSize: 11, color: INK_DIM }}>{r.sizes}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontFeatureSettings: '"tnum"', fontWeight: 600 }}>
                        {r.errs?.price
                          ? <span style={{ color: ALERT, borderBottom: `2px wavy ${ALERT}` }}>{r.price}</span>
                          : `$${r.price}`}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {r.status === 'add' && <Chip tone="success" size="sm">+ Add</Chip>}
                        {r.status === 'update' && <Chip tone="info" size="sm">Update</Chip>}
                        {r.status === 'error' && <Chip tone="danger" size="sm">Fix needed</Chip>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Inline error footer */}
          <div style={{ padding: '10px 14px', background: '#FDF1ED', borderTop: `1px solid ${RULE}`,
            display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
            <AdminIcon kind="warn" size={14} color={ALERT} />
            <span><b>Row 6 · Price</b> "free" must be a number with two decimals (e.g. <code style={{ fontFamily: MONO, background: '#fff', padding: '0 4px', borderRadius: 3 }}>45.00</code>).</span>
            <span style={{ width: 1, height: 14, background: '#E5BDB4' }} />
            <span><b>Row 9 · SKU</b> required for all new products.</span>
            <div style={{ flex: 1 }} />
            <Btn variant="ghost" size="sm">Skip errored rows</Btn>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Operator 5 — Pick slip / packing list (printable).
// ─────────────────────────────────────────────────────────────
function ScreenAdminPickSlip({ tenantId = 'nsbh' }) {
  const tenant = TENANTS[tenantId];
  return (
    <div style={{ width: ADMIN_W, height: ADMIN_H, background: '#E8E2D2', fontFamily: SANS,
      color: INK, display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      padding: 32, overflow: 'hidden' }}>
      <div style={{ width: 760, background: '#fff', boxShadow: '0 12px 40px -16px rgba(0,0,0,0.2)',
        padding: 56, fontFamily: SERIF, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, left: 16, right: 16, display: 'flex',
          justifyContent: 'space-between', fontFamily: SANS, fontSize: 10, color: INK_DIM }}>
          <span>uniformorder.com.au</span>
          <span>Pick slip · printed 27 Apr 2026</span>
        </div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <Crest tenant={tenant} size={64} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: SANS, fontSize: 10.5, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: INK_DIM }}>Uniform shop pick slip</div>
            <h1 style={{ fontSize: 24, fontWeight: 500, margin: '4px 0 4px', letterSpacing: -0.3 }}>{tenant.name}</h1>
            <div style={{ fontFamily: SANS, fontSize: 11, color: INK_DIM }}>{tenant.address} · {tenant.shopHours}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 600 }}>NSBH-04298</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: INK_DIM }}>Placed 27 Apr · 9:42am</div>
          </div>
        </div>
        <DoubleRule />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: '16px 0' }}>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: INK_DIM, marginBottom: 4 }}>Student</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Riley Qiao</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: INK_DIM }}>Year 9 · Roll 9F</div>
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: INK_DIM, marginBottom: 4 }}>Parent</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>George Qiao</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: INK_DIM }}>0405 178 183</div>
          </div>
          <div>
            <div style={{ fontFamily: SANS, fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: INK_DIM, marginBottom: 4 }}>Fulfilment</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>Pickup at office</div>
            <div style={{ fontFamily: SANS, fontSize: 11, color: INK_DIM }}>Notify when ready</div>
          </div>
        </div>
        <DoubleRule />
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS, fontSize: 13, marginTop: 14 }}>
          <thead>
            <tr style={{ color: INK_DIM, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6 }}>
              <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}`, width: 30 }}>✓</th>
              <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}` }}>Item</th>
              <th style={{ textAlign: 'left', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}`, width: 130 }}>Variant</th>
              <th style={{ textAlign: 'center', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}`, width: 60 }}>Size</th>
              <th style={{ textAlign: 'center', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}`, width: 50 }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontWeight: 700, borderBottom: `1px solid ${RULE}`, width: 80 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE_CART.map((l, i) => (
              <tr key={i} style={{ borderBottom: `1px dashed ${RULE}` }}>
                <td style={{ padding: '12px 0' }}>
                  <div style={{ width: 18, height: 18, border: `1.5px solid ${INK}`, borderRadius: 3 }} />
                </td>
                <td style={{ padding: '12px 0', fontWeight: 500 }}>{l.name}</td>
                <td style={{ padding: '12px 0', color: INK_DIM, fontSize: 12 }}>{l.variantLabel}</td>
                <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: 700, fontFamily: MONO }}>{l.size}</td>
                <td style={{ padding: '12px 0', textAlign: 'center', fontWeight: 700, fontFamily: MONO }}>{l.qty}</td>
                <td style={{ padding: '12px 0', textAlign: 'right', fontFeatureSettings: '"tnum"', fontWeight: 600 }}>${l.price * l.qty}.00</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ padding: '14px 0', textAlign: 'right', fontFamily: SERIF, fontSize: 16, fontWeight: 600 }}>Total (incl. GST)</td>
              <td style={{ padding: '14px 0', textAlign: 'right', fontFamily: SERIF, fontSize: 22, fontWeight: 600, fontFeatureSettings: '"tnum"' }}>$363.00</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: 24, padding: '14px 16px', background: PARCHMENT, borderRadius: 4,
          fontFamily: SANS, fontSize: 11, color: INK_DIM, lineHeight: 1.6 }}>
          <b style={{ color: INK }}>Packer notes</b> · All shirts in original packaging. Riley wore size 14 last year, sized up by parent. Notify <b>george.qiao@gmail.com</b> when ready.
        </div>
        {/* Barcode */}
        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: MONO, fontSize: 11, color: INK_DIM }}>Paid via Stripe · pi_3OrAqK · Mastercard •• 4745</div>
          <Barcode />
        </div>
      </div>
    </div>
  );
}

function Barcode() {
  const widths = [3,1,2,1,1,3,1,2,3,1,1,2,3,2,1,1,3,1,2,1,1,3,2,1];
  let x = 0;
  return (
    <svg width={180} height={48}>
      {widths.map((w, i) => {
        const fill = i % 2 === 0 ? INK : 'transparent';
        const el = <rect key={i} x={x} y={0} width={w * 2} height={36} fill={fill} />;
        x += w * 2 + 1;
        return el;
      })}
      <text x={0} y={46} fontFamily={MONO} fontSize="10" fill={INK_DIM} letterSpacing="2">NSBH-04298</text>
    </svg>
  );
}

Object.assign(window, {
  ScreenAdminDashboard, ScreenAdminOrders, ScreenAdminCatalog,
  ScreenAdminUpload, ScreenAdminPickSlip,
  ADMIN_W, ADMIN_H, AdminIcon,
});
