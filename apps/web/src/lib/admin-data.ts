// Admin/operator mock data for UniformOrder.
// Provides order management, sales analytics, and catalog CRUD data.

import type { TenantId, CartLine } from "./data";

export type OrderStatus = "pending_payment" | "new" | "packing" | "ready" | "collected";
export type DeliveryType = "pickup" | "ship";

export interface AdminOrder {
  id: string;
  tenantId: TenantId;
  status: OrderStatus;
  delivery: DeliveryType;
  placedAt: string;
  kid: string;
  year: string;
  rollClass: string;
  parent: string;
  mobile: string;
  email: string;
  items: CartLine[];
  total: number;
  stripeRef?: string;
  notes?: string;
}

const IMHS_ORDERS: AdminOrder[] = [
  {
    id: "IMHS-04298",
    tenantId: "imhs",
    status: "packing",
    delivery: "pickup",
    placedAt: "27 Apr 2026 · 9:42am",
    kid: "Tim Doe",
    year: "Year 9",
    rollClass: "9F",
    parent: "Jane Doe",
    mobile: "0400 000 000",
    email: "support@pimspace.com",
    items: [
      { itemId: "shirt-ls", variantLabel: "10–24", size: "16", qty: 2, price: 28, name: "White Shirt — Long Sleeves" },
      { itemId: "jumper", variantLabel: "12–16", size: "16", qty: 1, price: 75, name: "Jumper — Wool Blend, Crested" },
      { itemId: "tie", variantLabel: "Year 7–10 long (137cm)", size: "7-10L", qty: 1, price: 18, name: "School Tie — Navy Crested" },
      { itemId: "tracks", variantLabel: "18–26", size: "20", qty: 1, price: 45, name: "Track Pants" },
      { itemId: "polo", variantLabel: "10–26", size: "16", qty: 1, price: 40, name: "Sports Polo Shirt" },
      { itemId: "sportsbag", variantLabel: "Large", size: "L", qty: 1, price: 46, name: "Sports Bag — Maroon" },
    ],
    total: 280,
    stripeRef: "pi_3OrAqK",
    notes: "All shirts in original packaging. Tim wore size 14 last year, sized up by parent.",
  },
  {
    id: "IMHS-04297",
    tenantId: "imhs",
    status: "new",
    delivery: "pickup",
    placedAt: "27 Apr 2026 · 8:55am",
    kid: "James Chen",
    year: "Year 7",
    rollClass: "7A",
    parent: "Lin Chen",
    mobile: "0400 000 000",
    email: "lin.chen@example.com",
    items: [
      { itemId: "shirt-ss", variantLabel: "10–26", size: "12", qty: 3, price: 32, name: "White Shirt — Short Sleeves" },
      { itemId: "shorts-sport", variantLabel: "12–24", size: "12", qty: 2, price: 30, name: "Sports Shorts" },
      { itemId: "cap", variantLabel: "One size", size: "OS", qty: 1, price: 17, name: "School Cap, Navy" },
    ],
    total: 173,
    stripeRef: "pi_3OrBmN",
  },
  {
    id: "IMHS-04296",
    tenantId: "imhs",
    status: "new",
    delivery: "ship",
    placedAt: "26 Apr 2026 · 4:12pm",
    kid: "Oliver Park",
    year: "Year 10",
    rollClass: "10C",
    parent: "Sarah Park",
    mobile: "0400 000 000",
    email: "sarah.park@example.com",
    items: [
      { itemId: "blazer", variantLabel: "88–95cm chest", size: "92", qty: 1, price: 185, name: "Blazer — Crested" },
      { itemId: "scarf", variantLabel: "One size", size: "OS", qty: 1, price: 20, name: "School Scarf" },
    ],
    total: 214.5,
    stripeRef: "pi_3OrCpQ",
  },
  {
    id: "IMHS-04295",
    tenantId: "imhs",
    status: "new",
    delivery: "pickup",
    placedAt: "26 Apr 2026 · 2:30pm",
    kid: "Ethan Williams",
    year: "Year 8",
    rollClass: "8B",
    parent: "Mark Williams",
    mobile: "0434 111 222",
    email: "mark.w@example.com",
    items: [
      { itemId: "jumper", variantLabel: "12–16", size: "14", qty: 1, price: 75, name: "Jumper — Wool Blend, Crested" },
      { itemId: "backpack", variantLabel: "One size", size: "OS", qty: 1, price: 89, name: "School Backpack — Navy with Crest" },
    ],
    total: 164,
    stripeRef: "pi_3OrDrS",
  },
  {
    id: "IMHS-04294",
    tenantId: "imhs",
    status: "ready",
    delivery: "pickup",
    placedAt: "25 Apr 2026 · 11:20am",
    kid: "Noah Thompson",
    year: "Year 11",
    rollClass: "11E",
    parent: "Kate Thompson",
    mobile: "0445 333 444",
    email: "kate.thompson@example.com",
    items: [
      { itemId: "shirt-ls", variantLabel: "10–24", size: "18", qty: 2, price: 28, name: "White Shirt — Long Sleeves" },
      { itemId: "tie", variantLabel: "Year 11–12 long (147cm)", size: "11-12L", qty: 1, price: 18, name: "School Tie — Navy Crested" },
      { itemId: "jacket", variantLabel: "12–3XL", size: "L", qty: 1, price: 100, name: "Jacket — Navy with Zip" },
    ],
    total: 174,
    stripeRef: "pi_3OrEtU",
  },
  {
    id: "IMHS-04293",
    tenantId: "imhs",
    status: "ready",
    delivery: "pickup",
    placedAt: "24 Apr 2026 · 3:45pm",
    kid: "Liam Davis",
    year: "Year 9",
    rollClass: "9C",
    parent: "John Davis",
    mobile: "0456 555 666",
    email: "john.davis@example.com",
    items: [
      { itemId: "polo", variantLabel: "10–26", size: "18", qty: 2, price: 40, name: "Sports Polo Shirt" },
      { itemId: "hoodie", variantLabel: "12–XXL", size: "18", qty: 1, price: 47, name: "Navy Hoodie" },
      { itemId: "shorts-sport", variantLabel: "12–24", size: "18", qty: 1, price: 30, name: "Sports Shorts" },
    ],
    total: 157,
    stripeRef: "pi_3OrFvW",
  },
  {
    id: "IMHS-04292",
    tenantId: "imhs",
    status: "ready",
    delivery: "ship",
    placedAt: "23 Apr 2026 · 10:00am",
    kid: "Mason Lee",
    year: "Year 12",
    rollClass: "12A",
    parent: "Amy Lee",
    mobile: "0467 777 888",
    email: "amy.lee@example.com",
    items: [
      { itemId: "blazer", variantLabel: "100–115cm chest", size: "105", qty: 1, price: 210, name: "Blazer — Crested" },
      { itemId: "scarf", variantLabel: "One size", size: "OS", qty: 1, price: 20, name: "School Scarf" },
      { itemId: "calc", variantLabel: "N/A", size: "OS", qty: 1, price: 33, name: "Scientific Calculator" },
    ],
    total: 272.5,
    stripeRef: "pi_3OrGxY",
  },
  {
    id: "IMHS-04291",
    tenantId: "imhs",
    status: "collected",
    delivery: "pickup",
    placedAt: "22 Apr 2026 · 9:15am",
    kid: "Aiden Brown",
    year: "Year 7",
    rollClass: "7D",
    parent: "Paul Brown",
    mobile: "0478 999 000",
    email: "paul.brown@example.com",
    items: [
      { itemId: "shirt-ss", variantLabel: "10–26", size: "10", qty: 3, price: 32, name: "White Shirt — Short Sleeves" },
      { itemId: "sock-white", variantLabel: "3–9", size: "3-9", qty: 3, price: 5, name: "White Sport Socks" },
      { itemId: "cap", variantLabel: "One size", size: "OS", qty: 1, price: 17, name: "School Cap, Navy" },
    ],
    total: 128,
    stripeRef: "pi_3OrHzA",
  },
];

const RGSH_ORDERS: AdminOrder[] = [
  {
    id: "RGHS-01892",
    tenantId: "rgsh",
    status: "new",
    delivery: "pickup",
    placedAt: "27 Apr 2026 · 10:15am",
    kid: "Sam Doe",
    year: "Year 7",
    rollClass: "7B",
    parent: "Jane Doe",
    mobile: "0400 000 000",
    email: "support@pimspace.com",
    items: [
      { itemId: "shirt-ss", variantLabel: "10–26", size: "12", qty: 2, price: 32, name: "White Shirt — Short Sleeves" },
      { itemId: "polo", variantLabel: "10–26", size: "12", qty: 1, price: 40, name: "Sports Polo Shirt" },
      { itemId: "backpack", variantLabel: "One size", size: "OS", qty: 1, price: 89, name: "School Backpack — Navy with Crest" },
    ],
    total: 193,
    stripeRef: "pi_3OrIbC",
  },
  {
    id: "RGHS-01891",
    tenantId: "rgsh",
    status: "packing",
    delivery: "pickup",
    placedAt: "26 Apr 2026 · 2:00pm",
    kid: "Sophie Wilson",
    year: "Year 9",
    rollClass: "9A",
    parent: "Helen Wilson",
    mobile: "0489 123 456",
    email: "helen.wilson@example.com",
    items: [
      { itemId: "jumper", variantLabel: "12–16", size: "14", qty: 1, price: 75, name: "Jumper — Wool Blend, Crested" },
      { itemId: "tie", variantLabel: "Year 7–10 long (137cm)", size: "7-10L", qty: 1, price: 18, name: "School Tie — Navy Crested" },
    ],
    total: 93,
    stripeRef: "pi_3OrJdE",
  },
];

export const ADMIN_ORDERS: AdminOrder[] = [...IMHS_ORDERS, ...RGSH_ORDERS];

export function getOrdersByTenant(tenantId: TenantId): AdminOrder[] {
  return ADMIN_ORDERS.filter((o) => o.tenantId === tenantId);
}

export function getOrderById(id: string): AdminOrder | undefined {
  return ADMIN_ORDERS.find((o) => o.id === id);
}

export interface SalesData {
  revenue: number;
  orders: number;
  avgOrder: number;
  awaitingPickup: number;
  spark: number[];
  topItems: { name: string; qty: number; revenue: number }[];
}

export const SALES_DATA: Record<TenantId, SalesData> = {
  imhs: {
    revenue: 18420,
    orders: 312,
    avgOrder: 59.04,
    awaitingPickup: 24,
    spark: [42, 58, 51, 67, 73, 62, 88, 79, 95, 84, 102, 98],
    topItems: [
      { name: "White Shirt — Short Sleeves", qty: 148, revenue: 4736 },
      { name: "Sports Polo Shirt", qty: 112, revenue: 4480 },
      { name: "Jumper — Wool Blend, Crested", qty: 89, revenue: 6675 },
      { name: "Track Pants", qty: 76, revenue: 3420 },
      { name: "School Backpack", qty: 54, revenue: 4806 },
    ],
  },
  rgsh: {
    revenue: 12840,
    orders: 218,
    avgOrder: 58.90,
    awaitingPickup: 16,
    spark: [38, 44, 52, 61, 58, 72, 68, 81, 77, 90, 86, 94],
    topItems: [
      { name: "White Shirt — Short Sleeves", qty: 102, revenue: 3264 },
      { name: "Sports Polo Shirt", qty: 88, revenue: 3520 },
      { name: "Jumper — Wool Blend, Crested", qty: 64, revenue: 4800 },
      { name: "School Backpack", qty: 42, revenue: 3738 },
      { name: "Track Pants", qty: 58, revenue: 2610 },
    ],
  },
};
