// data.jsx — shared mock data + design tokens for UniformOrder
// Two demo tenants (NSBH for Riley + a girls' school for the daughter Mia),
// catalog items adapted from the NSBH paper form, and one parent (George Qiao).

const NAVY = '#0E2A47';
const NAVY_DEEP = '#081A2D';
const NAVY_SOFT = '#1B3A5F';
const PARCHMENT = '#FAF6EE';
const PAPER = '#FDFBF6';
const INK = '#15212F';
const INK_DIM = '#56657A';
const RULE = '#E5DFD2';
const GOLD = '#B08A3E';
const SAGE = '#5C7A55';
const ALERT = '#B23A2A';
const SUCCESS = '#2F6B3D';

// Per-tenant theme — only logo + accent + name change. Everything else stays
// platform-branded (navy + serif).
const TENANTS = {
  nsbh: {
    id: 'nsbh',
    name: 'Imagined High School',
    short: 'IMHS',
    crest: 'IMHS',
    accent: '#7A1F2B',           // school maroon
    accentInk: '#FFFFFF',
    motto: 'Aeterna non caduca',
    address: 'Falcon St, Crows Nest NSW 2065',
    shopHours: 'Mon & Thu · 8:15am – 1:30pm',
    shopEmail: 'uniformshop@imhs.nsw.edu.au',
  },
  rgsh: {
    id: 'rgsh',
    name: 'Riverside Girls High School',
    short: 'RGHS',
    crest: 'RGHS',
    accent: '#2F5D50',           // forest green
    accentInk: '#FFFFFF',
    motto: 'Per ardua ad astra',
    address: 'Huntleys Point Rd, Huntleys Point NSW 2111',
    shopHours: 'Tue & Fri · 8:00am – 1:00pm',
    shopEmail: 'uniformshop@rghs.nsw.edu.au',
  },
};

// Catalog — modelled on the NSBH paper form. Each item has variants with size
// labels & prices. Stock not tracked (out of scope for MVP).
const SIZES_GENERIC = ['10','12','14','16','18','20','22','24','26'];

const CATALOG_NSBH = [
  { id: 'shirt-ss', cat: 'Summer', name: 'White Shirt — Short Sleeves',
    desc: 'Embroidered school crest. Poly-cotton blend, machine wash cold.',
    variants: [
      { label: 'Boys 10–26', price: 32, sizes: SIZES_GENERIC },
      { label: 'Mens 4–8', price: 43, sizes: ['4','5','6','7','8'] },
    ],
    sizeGuide: { unit: 'cm', cols: ['Size','Chest','Length'],
      rows: [['10','78','62'],['12','82','64'],['14','86','66'],['16','90','68'],['18','94','70'],['20','98','72'],['22','102','74'],['24','106','76'],['26','110','78']] },
  },
  { id: 'cap', cat: 'Summer', name: 'School Cap, Navy',
    desc: 'Embroidered NSBH crest. One size, adjustable strap.',
    variants: [{ label: 'One size', price: 17, sizes: ['OS'] }] },
  { id: 'sock-white', cat: 'Summer', name: 'White Sport Socks (cotton blend, midi)',
    desc: 'Pack of one pair.',
    variants: [{ label: '3–9', price: 5, sizes: ['3-9'] }, { label: '7–11', price: 5, sizes: ['7-11'] }] },
  { id: 'shirt-ls', cat: 'Winter', name: 'White Shirt — Long Sleeves',
    desc: 'Embroidered school crest. Poly-cotton blend.',
    variants: [
      { label: 'Boys 10–24', price: 28, sizes: ['10','12','14','16','18','20','22','24'] },
      { label: 'Mens 5–8', price: 59, sizes: ['5','6','7','8'] },
    ],
    sizeGuide: { unit: 'cm', cols: ['Size','Chest','Sleeve'],
      rows: [['10','80','58'],['12','84','60'],['14','88','62'],['16','92','64'],['18','96','66'],['20','100','68'],['22','104','70'],['24','108','72']] },
  },
  { id: 'jumper', cat: 'Winter', name: 'Jumper — Wool Blend, Crested',
    desc: 'V-neck pullover with embroidered school crest.',
    variants: [
      { label: '12–16', price: 75, sizes: ['12','14','16'] },
      { label: '18–22', price: 77, sizes: ['18','20','22'] },
      { label: '24–26', price: 82, sizes: ['24','26'] },
    ] },
  { id: 'trousers', cat: 'Winter', name: 'Trousers — Mid Grey, Pleated Front',
    desc: 'Poly/viscose blend with adjustable waist.',
    variants: [
      { label: 'Year 7–10 short (127cm)', price: 17, sizes: ['7-10S'] },
      { label: 'Year 7–10 long (137cm)', price: 18, sizes: ['7-10L'] },
      { label: 'Year 11–12 short (137cm)', price: 17, sizes: ['11-12S'] },
      { label: 'Year 11–12 long (147cm)', price: 18, sizes: ['11-12L'] },
    ] },
  { id: 'belt', cat: 'Winter', name: 'Belt — Black Leather, Silver Buckle',
    variants: [{ label: '70–95cm', price: 15, sizes: ['70','75','80','85','90','95'] }] },
  { id: 'jacket', cat: 'Winter', name: 'Jacket — Navy with Zip',
    variants: [{ label: '12–3XL', price: 100, sizes: ['12','14','16','18','L','XL','XXL','3XL'] }] },
  { id: 'tie', cat: 'Winter', name: 'School Tie — Navy Crested',
    variants: [{ label: 'One size', price: 20, sizes: ['OS'] }] },
  { id: 'polo', cat: 'Sports', name: 'Sports Polo Shirt',
    desc: 'Breathable mesh weave with embroidered crest.',
    variants: [{ label: '10–26', price: 40, sizes: SIZES_GENERIC }] },
  { id: 'shorts-sport', cat: 'Sports', name: 'Sports Shorts',
    variants: [{ label: '12–24', price: 30, sizes: ['12','14','16','18','20','22','24'] }] },
  { id: 'hoodie', cat: 'Sports', name: 'Navy Hoodie',
    variants: [{ label: '12–XXL', price: 47, sizes: ['12','14','16','18','20','L','XL','XXL'] }] },
  { id: 'tracks', cat: 'Sports', name: 'Track Pants',
    variants: [
      { label: '12–16', price: 43, sizes: ['12','14','16'] },
      { label: '18–26', price: 45, sizes: ['18','20','22','24','26'] },
    ] },
  { id: 'sock-sport', cat: 'Sports', name: 'Sports Socks (soccer / hockey / rugby)',
    variants: [{ label: '2–7 / 7–11 / XL', price: 12, sizes: ['2-7','7-11','XL'] }] },
  { id: 'blazer', cat: 'Formal', name: 'Blazer — Crested',
    desc: 'Wool-blend, fully lined, embroidered pocket crest.',
    variants: [
      { label: '88–95cm chest', price: 185, sizes: ['88','92','95'] },
      { label: '100–115cm chest', price: 210, sizes: ['100','105','110','115'] },
    ] },
  { id: 'backpack', cat: 'Bags', name: 'School Backpack — Navy with Crest',
    variants: [{ label: 'One size', price: 89, sizes: ['OS'] }] },
  { id: 'sportsbag', cat: 'Bags', name: 'Sports Bag — Maroon with Crest',
    variants: [
      { label: 'Small', price: 39, sizes: ['S'] },
      { label: 'Large', price: 46, sizes: ['L'] },
    ] },
  { id: 'calc', cat: 'Stationery', name: 'Scientific Calculator',
    variants: [{ label: 'N/A', price: 33, sizes: ['OS'] }] },
  { id: 'mathset', cat: 'Stationery', name: 'Math Set',
    variants: [{ label: 'N/A', price: 7, sizes: ['OS'] }] },
];

// Riley's saved cart (matches the paper form to make the demo feel real).
const SAMPLE_CART = [
  { itemId: 'shirt-ls', variantLabel: 'Boys 10–24', size: '16', qty: 2, price: 28, name: 'White Shirt — Long Sleeves' },
  { itemId: 'jumper',   variantLabel: '12–16',      size: '16', qty: 1, price: 75, name: 'Jumper — Wool Blend, Crested' },
  { itemId: 'trousers', variantLabel: 'Year 7–10 long (137cm)', size: '7-10L', qty: 1, price: 18, name: 'Trousers — Mid Grey' },
  { itemId: 'tracks',   variantLabel: '18–26',      size: '20', qty: 1, price: 45, name: 'Track Pants' },
  { itemId: 'polo',     variantLabel: '10–26',      size: '16', qty: 1, price: 40, name: 'Sports Polo Shirt' },
  { itemId: 'sportsbag',variantLabel: 'Large',      size: 'L',  qty: 1, price: 46, name: 'Sports Bag — Maroon' },
];

// Past orders for the re-order screen.
const PAST_ORDERS = [
  { id: 'NSBH-04231', date: '14 Jan 2026', kid: 'Riley', school: 'nsbh', total: 286, items: 6, status: 'collected' },
  { id: 'NSBH-04102', date: '03 Dec 2025', kid: 'Riley', school: 'nsbh', total: 124, items: 3, status: 'collected' },
  { id: 'RGHS-01880', date: '22 Jan 2026', kid: 'Mia',   school: 'rgsh', total: 218, items: 5, status: 'collected' },
];

// Operator-side: order queue across statuses.
const ADMIN_ORDERS = [
  { id: 'NSBH-04298', parent: 'George Qiao', kid: 'Riley Qiao', year: 'Year 9', items: 6, total: 363, placed: '27 Apr · 9:42am', status: 'new', delivery: 'pickup', email: 'george.qiao@gmail.com' },
  { id: 'NSBH-04297', parent: 'Sarah Patel', kid: 'Arjun Patel', year: 'Year 7', items: 4, total: 178, placed: '27 Apr · 8:11am', status: 'new', delivery: 'pickup' },
  { id: 'NSBH-04296', parent: 'Lin Chen',    kid: 'Ethan Chen',  year: 'Year 11', items: 2, total: 102, placed: '26 Apr · 7:30pm', status: 'new', delivery: 'ship' },
  { id: 'NSBH-04295', parent: 'Jane Whitlam',kid: 'Tom Whitlam', year: 'Year 8', items: 8, total: 412, placed: '26 Apr · 4:55pm', status: 'packing', delivery: 'pickup' },
  { id: 'NSBH-04294', parent: 'Diego Moreno',kid: 'Mateo Moreno',year: 'Year 9', items: 3, total: 95,  placed: '26 Apr · 2:18pm', status: 'packing', delivery: 'pickup' },
  { id: 'NSBH-04293', parent: 'Anna Kovac',  kid: 'Luka Kovac',  year: 'Year 10', items: 5, total: 240, placed: '26 Apr · 11:02am', status: 'ready', delivery: 'pickup' },
  { id: 'NSBH-04292', parent: 'Mei Zhang',   kid: 'Oliver Zhang',year: 'Year 7', items: 7, total: 388, placed: '25 Apr · 5:41pm', status: 'ready', delivery: 'pickup' },
  { id: 'NSBH-04291', parent: 'Tom Reilly',  kid: 'Sam Reilly',  year: 'Year 12', items: 1, total: 22,  placed: '25 Apr · 1:09pm', status: 'collected', delivery: 'pickup' },
  { id: 'NSBH-04290', parent: 'Priya Singh', kid: 'Aarav Singh', year: 'Year 8', items: 4, total: 168, placed: '24 Apr · 4:20pm', status: 'collected', delivery: 'pickup' },
];

// Multi-tenant — Super-admin lists all schools on the platform.
const PLATFORM_TENANTS = [
  { id: 'nsbh', name: 'North Sydney Boys High School',  short: 'NSBH',  parents: 1240, orders30d: 312, mrr: 0,  plan: 'Standard', status: 'active', since: 'Jan 2025', accent: '#7A1F2B' },
  { id: 'rgsh', name: 'Riverside Girls High School',    short: 'RGHS',  parents: 980,  orders30d: 244, mrr: 0,  plan: 'Standard', status: 'active', since: 'Mar 2025', accent: '#2F5D50' },
  { id: 'kbhs', name: 'Killara High School',            short: 'KHS',   parents: 1410, orders30d: 401, mrr: 0,  plan: 'Standard', status: 'active', since: 'Aug 2025', accent: '#1F3A6E' },
  { id: 'spc',  name: 'St Patrick\u2019s College',      short: 'SPC',   parents: 720,  orders30d: 188, mrr: 0,  plan: 'Standard', status: 'active', since: 'Sep 2025', accent: '#4A2238' },
  { id: 'mbgs', name: 'Manly Beach Grammar School',     short: 'MBGS',  parents: 540,  orders30d: 0,   mrr: 0,  plan: 'Trial',    status: 'trial',  since: 'Apr 2026', accent: '#0F4C5C' },
  { id: 'cgs',  name: 'Cherrybrook Girls School',       short: 'CGS',   parents: 0,    orders30d: 0,   mrr: 0,  plan: 'Trial',    status: 'pending',since: 'Apr 2026', accent: '#6E3B5C' },
];

// Sales dashboard mock numbers (operator view, last 30 days for NSBH).
const SALES = {
  revenue: 18420,
  orders: 312,
  avgOrder: 59.04,
  topItems: [
    { name: 'White Shirt — Short Sleeves', qty: 184, revenue: 5888 },
    { name: 'Jumper — Wool Blend, Crested', qty: 67, revenue: 5093 },
    { name: 'Sports Polo Shirt', qty: 92, revenue: 3680 },
    { name: 'Trousers — Mid Grey', qty: 71, revenue: 1278 },
    { name: 'Track Pants', qty: 38, revenue: 1696 },
  ],
  spark: [12,18,9,22,28,17,24,33,29,38,31,42,36,48,52,41,55,60,52,68,72,64,78,82,73,88,94,86,102,98],
};

export {
  NAVY, NAVY_DEEP, NAVY_SOFT, PARCHMENT, PAPER, INK, INK_DIM, RULE, GOLD, SAGE, ALERT, SUCCESS,
  TENANTS, SIZES_GENERIC, CATALOG_NSBH, SAMPLE_CART, PAST_ORDERS, ADMIN_ORDERS, PLATFORM_TENANTS, SALES,
};
