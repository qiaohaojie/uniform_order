// Seed script — run with: node scripts/seed.mjs
// Requires DATABASE_URL in .env.local

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && !key.startsWith("#")) {
    process.env[key.trim()] = rest.join("=").trim();
  }
}

import("@neondatabase/serverless").then(async ({ neon }) => {
  const sql = neon(process.env.DATABASE_URL);

  console.log("🌱 Seeding tenants...");
  await sql`
    INSERT INTO tenants (id, name, short, accent, motto, address, shop_hours, shop_email)
    VALUES
      ('nsbh', 'North Sydney Boys High School', 'NSBH', '#7A1F2B',
       'Aeterna non caduca', 'Falcon St, Crows Nest NSW 2065',
       'Mon & Thu · 8:15am – 1:30pm', 'uniformshop@nsbh.nsw.edu.au'),
      ('rgsh', 'Riverside Girls High School', 'RGHS', '#2F5D50',
       'Per ardua ad astra', 'Huntleys Point Rd, Huntleys Point NSW 2111',
       'Tue & Fri · 8:00am – 1:00pm', 'uniformshop@rghs.nsw.edu.au')
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, short = EXCLUDED.short, accent = EXCLUDED.accent,
      motto = EXCLUDED.motto, address = EXCLUDED.address,
      shop_hours = EXCLUDED.shop_hours, shop_email = EXCLUDED.shop_email,
      updated_at = now()
  `;

  console.log("🌱 Seeding catalog items for NSBH...");

  const items = [
    // Summer
    { id: "shirt-ss", tenantId: "nsbh", name: "White Shirt — Short Sleeves", category: "Summer", description: "Embroidered school crest. Poly-cotton blend, machine wash cold.", sortOrder: 1 },
    { id: "cap", tenantId: "nsbh", name: "School Cap, Navy", category: "Summer", description: "Embroidered NSBH crest. One size, adjustable strap.", sortOrder: 2 },
    { id: "sock-white", tenantId: "nsbh", name: "White Sport Socks (cotton blend, midi)", category: "Summer", description: "Pack of one pair.", sortOrder: 3 },
    // Winter
    { id: "shirt-ls", tenantId: "nsbh", name: "White Shirt — Long Sleeves", category: "Winter", description: "Embroidered school crest. Poly-cotton blend.", sortOrder: 4 },
    { id: "jumper", tenantId: "nsbh", name: "Jumper — Wool Blend, Crested", category: "Winter", description: "V-neck pullover with embroidered school crest.", sortOrder: 5 },
    { id: "trousers", tenantId: "nsbh", name: "Trousers — Mid Grey, Pleated Front", category: "Winter", description: "Poly/viscose blend with adjustable waist.", sortOrder: 6 },
    { id: "belt", tenantId: "nsbh", name: "Belt — Black Leather, Silver Buckle", category: "Winter", description: null, sortOrder: 7 },
    { id: "jacket", tenantId: "nsbh", name: "Jacket — Navy with Zip", category: "Winter", description: null, sortOrder: 8 },
    { id: "tie", tenantId: "nsbh", name: "School Tie — Navy Crested", category: "Winter", description: null, sortOrder: 9 },
    // Sports
    { id: "polo", tenantId: "nsbh", name: "Sports Polo Shirt", category: "Sports", description: "Breathable mesh weave with embroidered crest.", sortOrder: 10 },
    { id: "shorts-sport", tenantId: "nsbh", name: "Sports Shorts", category: "Sports", description: null, sortOrder: 11 },
    { id: "hoodie", tenantId: "nsbh", name: "Navy Hoodie", category: "Sports", description: null, sortOrder: 12 },
    { id: "tracks", tenantId: "nsbh", name: "Track Pants", category: "Sports", description: null, sortOrder: 13 },
    { id: "sock-sport", tenantId: "nsbh", name: "Sports Socks (soccer / hockey / rugby)", category: "Sports", description: null, sortOrder: 14 },
    // Formal
    { id: "blazer", tenantId: "nsbh", name: "Blazer — Crested", category: "Formal", description: "Wool-blend, fully lined, embroidered pocket crest.", sortOrder: 15 },
    // Bags
    { id: "backpack", tenantId: "nsbh", name: "School Backpack — Navy with Crest", category: "Bags", description: null, sortOrder: 16 },
    { id: "sportsbag", tenantId: "nsbh", name: "Sports Bag — Maroon with Crest", category: "Bags", description: null, sortOrder: 17 },
    // Stationery
    { id: "calc", tenantId: "nsbh", name: "Scientific Calculator", category: "Stationery", description: null, sortOrder: 18 },
    { id: "mathset", tenantId: "nsbh", name: "Math Set", category: "Stationery", description: null, sortOrder: 19 },
    // Paper-form items not previously seeded (PDP §4)
    { id: "shorts-navy", tenantId: "nsbh", name: "Navy Shorts — Adjustable Side Tabs", category: "Summer", description: "Navy poly/viscose with adjustable side tabs.", sortOrder: 20 },
    { id: "sock-grey", tenantId: "nsbh", name: "Grey Socks (cotton blend, midi)", category: "Winter", description: "Pack of one pair.", sortOrder: 21 },
    { id: "scarf", tenantId: "nsbh", name: "School Scarf", category: "Winter", description: null, sortOrder: 22 },
    { id: "prefect-tie", tenantId: "nsbh", name: "Prefect Tie", category: "Winter", description: null, sortOrder: 23 },
    { id: "soccer-jersey", tenantId: "nsbh", name: "Soccer Jersey", category: "Sports", description: null, sortOrder: 24 },
    { id: "swimming-briefs", tenantId: "nsbh", name: "Swimming Briefs", category: "Sports", description: null, sortOrder: 25 },
    { id: "exercise-book-a4", tenantId: "nsbh", name: "A4 Exercise Book — 128 pages, plastic cover", category: "Stationery", description: null, sortOrder: 26 },
    { id: "exercise-book-math", tenantId: "nsbh", name: "Math Exercise Book — 128 pages, plastic cover", category: "Stationery", description: null, sortOrder: 27 },
    { id: "ring-binder", tenantId: "nsbh", name: "Ring Binder — Crested", category: "Stationery", description: null, sortOrder: 28 },
  ];

  for (const item of items) {
    await sql`
      INSERT INTO catalog_items (id, tenant_id, name, category, description, sort_order)
      VALUES (${item.id}, ${item.tenantId}, ${item.name}, ${item.category}, ${item.description}, ${item.sortOrder})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, category = EXCLUDED.category,
        description = EXCLUDED.description, sort_order = EXCLUDED.sort_order,
        updated_at = now()
    `;
  }

  console.log("🌱 Seeding RGSH catalog items...");

  const rgshCatalogItemsRows = items.map((it) => ({
    ...it,
    id: `rgsh-${it.id}`,
    tenantId: "rgsh",
  }));

  for (const item of rgshCatalogItemsRows) {
    await sql`
      INSERT INTO catalog_items (id, tenant_id, name, category, description, sort_order)
      VALUES (${item.id}, ${item.tenantId}, ${item.name}, ${item.category}, ${item.description}, ${item.sortOrder})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, category = EXCLUDED.category,
        description = EXCLUDED.description, sort_order = EXCLUDED.sort_order,
        updated_at = now()
    `;
  }

  console.log("🌱 Seeding catalog variants...");

  const variants = [
    // shirt-ss (paper form has only one size row: 10–26 → $32)
    { itemId: "shirt-ss", label: "10–26", price: 32, sizes: ["10", "12", "14", "16", "18", "20", "22", "24", "26"] },
    // cap
    { itemId: "cap", label: "One size", price: 17, sizes: [] },
    // sock-white
    { itemId: "sock-white", label: "3–9", price: 5, sizes: ["3-9"] },
    { itemId: "sock-white", label: "7–11", price: 5, sizes: ["7-11"] },
    // shirt-ls (paper form has only one size row: 10–24 → $28)
    { itemId: "shirt-ls", label: "10–24", price: 28, sizes: ["10", "12", "14", "16", "18", "20", "22", "24"] },
    // jumper
    { itemId: "jumper", label: "12–16", price: 75, sizes: ["12", "14", "16"] },
    { itemId: "jumper", label: "18–22", price: 77, sizes: ["18", "20", "22"] },
    { itemId: "jumper", label: "24–26", price: 82, sizes: ["24", "26"] },
    // trousers (paper form: 10,12,…,18 → $57; men 5–8 → $59)
    { itemId: "trousers", label: "10–18", price: 57, sizes: ["10", "12", "14", "16", "18"] },
    { itemId: "trousers", label: "Mens 5–8", price: 59, sizes: ["5", "6", "7", "8"] },
    // belt
    { itemId: "belt", label: "70–95cm", price: 15, sizes: ["70cm", "75cm", "80cm", "85cm", "90cm", "95cm"] },
    // jacket
    { itemId: "jacket", label: "12–3XL", price: 100, sizes: ["12", "14", "16", "18", "20", "XS", "S", "M", "L", "XL", "2XL", "3XL"] },
    // tie (paper form: 4 length-by-year-group rows)
    { itemId: "tie", label: "Year 7–10 short (127cm)", price: 17, sizes: [] },
    { itemId: "tie", label: "Year 7–10 long (137cm)", price: 18, sizes: [] },
    { itemId: "tie", label: "Year 11–12 short (137cm)", price: 17, sizes: [] },
    { itemId: "tie", label: "Year 11–12 long (147cm)", price: 18, sizes: [] },
    // polo
    { itemId: "polo", label: "10–26", price: 40, sizes: ["10", "12", "14", "16", "18", "20", "22", "24", "26"] },
    // shorts-sport
    { itemId: "shorts-sport", label: "12–24", price: 30, sizes: ["12", "14", "16", "18", "20", "22", "24"] },
    // hoodie
    { itemId: "hoodie", label: "12–XXL", price: 47, sizes: ["12", "14", "16", "18", "20", "XS", "S", "M", "L", "XL", "XXL"] },
    // tracks
    { itemId: "tracks", label: "12–16", price: 43, sizes: ["12", "14", "16"] },
    { itemId: "tracks", label: "18–26", price: 45, sizes: ["18", "20", "22", "24", "26"] },
    // sock-sport
    { itemId: "sock-sport", label: "2–7 / 7–11 / XL", price: 12, sizes: ["2-7", "7-11", "XL"] },
    // blazer
    { itemId: "blazer", label: "88–95cm chest", price: 185, sizes: ["88cm", "90cm", "92cm", "95cm"] },
    { itemId: "blazer", label: "100–115cm chest", price: 210, sizes: ["100cm", "105cm", "110cm", "115cm"] },
    // backpack
    { itemId: "backpack", label: "One size", price: 89, sizes: [] },
    // sportsbag
    { itemId: "sportsbag", label: "Small", price: 39, sizes: [] },
    { itemId: "sportsbag", label: "Large", price: 46, sizes: [] },
    // calc
    { itemId: "calc", label: "N/A", price: 33, sizes: [] },
    // mathset
    { itemId: "mathset", label: "N/A", price: 7, sizes: [] },
    // shorts-navy
    { itemId: "shorts-navy", label: "Boys 10–16", price: 43, sizes: ["10", "12", "14", "16"] },
    { itemId: "shorts-navy", label: "Mens 4–8", price: 45, sizes: ["4", "5", "6", "7", "8"] },
    // sock-grey
    { itemId: "sock-grey", label: "3–9", price: 5, sizes: ["3-9"] },
    { itemId: "sock-grey", label: "7–11", price: 5, sizes: ["7-11"] },
    // scarf
    { itemId: "scarf", label: "One size", price: 20, sizes: [] },
    // prefect-tie
    { itemId: "prefect-tie", label: "147cm", price: 22, sizes: [] },
    // soccer-jersey
    { itemId: "soccer-jersey", label: "12–22", price: 40, sizes: ["12", "14", "16", "18", "20", "22"] },
    // swimming-briefs
    { itemId: "swimming-briefs", label: "XS–XXL", price: 45, sizes: ["XS", "S", "M", "L", "XL", "XXL"] },
    // exercise-book-a4
    { itemId: "exercise-book-a4", label: "N/A", price: 2, sizes: [] },
    // exercise-book-math
    { itemId: "exercise-book-math", label: "N/A", price: 2, sizes: [] },
    // ring-binder
    { itemId: "ring-binder", label: "N/A", price: 5, sizes: [] },
  ];

  const rgshCatalogVariantsRows = variants.map((v) => ({
    ...v,
    itemId: `rgsh-${v.itemId}`,
  }));

  const allVariants = [...variants, ...rgshCatalogVariantsRows];

  // Delete existing variants for these items first (to avoid duplicates on re-seed)
  const itemIds = [...new Set(allVariants.map(v => v.itemId))];
  for (const itemId of itemIds) {
    await sql`DELETE FROM catalog_variants WHERE item_id = ${itemId}`;
  }

  for (const v of allVariants) {
    await sql`
      INSERT INTO catalog_variants (item_id, label, price, sizes)
      VALUES (${v.itemId}, ${v.label}, ${v.price}, ${JSON.stringify(v.sizes ?? [])}::jsonb)
    `;
  }

  console.log("🌱 Seeding sample orders...");

  // Seed 3 sample orders (from ADMIN_ORDERS mock data)
  const sampleOrders = [
    {
      id: "NSBH-04298",
      tenantId: "nsbh",
      parentName: "Sarah Chen",
      parentEmail: "sarah.chen@gmail.com",
      parentMobile: "0412 345 678",
      studentName: "Ethan Chen",
      studentYear: "Year 9",
      studentRoll: "9A",
      delivery: "pickup",
      deliveryFee: 0,
      subtotal: 252.00,
      gst: 22.91,
      total: 252.00,
      stripeRef: "pi_3QVrmm_test_001",
      status: "new",
    },
    {
      id: "NSBH-04297",
      tenantId: "nsbh",
      parentName: "James Okafor",
      parentEmail: "james.okafor@outlook.com",
      parentMobile: "0423 456 789",
      studentName: "Liam Okafor",
      studentYear: "Year 7",
      studentRoll: "7C",
      delivery: "pickup",
      deliveryFee: 0,
      subtotal: 186.00,
      gst: 16.91,
      total: 186.00,
      stripeRef: "pi_3QVrmm_test_002",
      status: "packing",
    },
    {
      id: "NSBH-04296",
      tenantId: "nsbh",
      parentName: "Priya Sharma",
      parentEmail: "priya.sharma@gmail.com",
      parentMobile: "0434 567 890",
      studentName: "Arjun Sharma",
      studentYear: "Year 11",
      studentRoll: "11B",
      delivery: "ship",
      deliveryFee: 9.50,
      subtotal: 320.00,
      gst: 29.09,
      total: 329.50,
      stripeRef: "pi_3QVrmm_test_003",
      status: "ready",
    },
  ];

  for (const order of sampleOrders) {
    await sql`
      INSERT INTO orders (id, tenant_id, parent_name, parent_email, parent_mobile,
        student_name, student_year, student_roll, delivery, delivery_fee,
        subtotal, gst, total, stripe_ref, status)
      VALUES (
        ${order.id}, ${order.tenantId}, ${order.parentName}, ${order.parentEmail},
        ${order.parentMobile}, ${order.studentName}, ${order.studentYear},
        ${order.studentRoll}, ${order.delivery}, ${order.deliveryFee},
        ${order.subtotal}, ${order.gst}, ${order.total}, ${order.stripeRef}, ${order.status}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }

  // Seed order lines for the first order
  const lines = [
    { orderId: "NSBH-04298", itemId: "shirt-ls", itemName: "White Shirt — Long Sleeves", variantLabel: "10–24", qty: 2, unitPrice: 28.00, lineTotal: 56.00 },
    { orderId: "NSBH-04298", itemId: "jumper", itemName: "Jumper — Wool Blend, Crested", variantLabel: "12–16", qty: 1, unitPrice: 75.00, lineTotal: 75.00 },
    { orderId: "NSBH-04298", itemId: "tie", itemName: "School Tie — Navy Crested", variantLabel: "Year 7–10 long (137cm)", qty: 1, unitPrice: 18.00, lineTotal: 18.00 },
    { orderId: "NSBH-04298", itemId: "polo", itemName: "Sports Polo Shirt", variantLabel: "10–26", qty: 1, unitPrice: 40.00, lineTotal: 40.00 },
    { orderId: "NSBH-04298", itemId: "tracks", itemName: "Track Pants", variantLabel: "18–26", qty: 1, unitPrice: 45.00, lineTotal: 45.00 },
    { orderId: "NSBH-04298", itemId: "sportsbag", itemName: "Sports Bag — Maroon", variantLabel: "Large", qty: 1, unitPrice: 46.00, lineTotal: 46.00 },
    // Lines for order 2
    { orderId: "NSBH-04297", itemId: "shirt-ss", itemName: "White Shirt — Short Sleeves", variantLabel: "10–26", qty: 2, unitPrice: 32.00, lineTotal: 64.00 },
    { orderId: "NSBH-04297", itemId: "cap", itemName: "School Cap, Navy", variantLabel: "One size", qty: 1, unitPrice: 17.00, lineTotal: 17.00 },
    { orderId: "NSBH-04297", itemId: "polo", itemName: "Sports Polo Shirt", variantLabel: "10–26", qty: 1, unitPrice: 40.00, lineTotal: 40.00 },
    { orderId: "NSBH-04297", itemId: "shorts-sport", itemName: "Sports Shorts", variantLabel: "12–24", qty: 1, unitPrice: 30.00, lineTotal: 30.00 },
    // Lines for order 3
    { orderId: "NSBH-04296", itemId: "blazer", itemName: "Blazer — Crested", variantLabel: "88–95cm chest", qty: 1, unitPrice: 185.00, lineTotal: 185.00 },
    { orderId: "NSBH-04296", itemId: "scarf", itemName: "School Scarf", variantLabel: "One size", qty: 1, unitPrice: 20.00, lineTotal: 20.00 },
    { orderId: "NSBH-04296", itemId: "jacket", itemName: "Jacket — Navy with Zip", variantLabel: "12–3XL", qty: 1, unitPrice: 100.00, lineTotal: 100.00 },
  ];

  // Delete existing lines for these orders first
  for (const orderId of ["NSBH-04298", "NSBH-04297", "NSBH-04296"]) {
    await sql`DELETE FROM order_lines WHERE order_id = ${orderId}`;
  }
  for (const line of lines) {
    await sql`
      INSERT INTO order_lines (order_id, item_id, item_name, variant_label, qty, unit_price, line_total)
      VALUES (${line.orderId}, ${line.itemId}, ${line.itemName}, ${line.variantLabel}, ${line.qty}, ${line.unitPrice}, ${line.lineTotal})
    `;
  }

  console.log("✅ Seed complete!");
  process.exit(0);
});
