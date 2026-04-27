// Mock data for UniformOrder — multi-tenant school uniform ordering.
// Two demo tenants (NSBH for son Riley, RGHS for daughter Mia), catalog
// adapted from the NSBH paper form, and one parent (George Qiao).

export type TenantId = "nsbh" | "rgsh";

export interface Tenant {
  id: TenantId;
  name: string;
  short: string;
  accent: string;
  accentInk: string;
  motto: string;
  address: string;
  shopHours: string;
  shopEmail: string;
}

export const TENANTS: Record<TenantId, Tenant> = {
  nsbh: {
    id: "nsbh",
    name: "North Sydney Boys High School",
    short: "NSBH",
    accent: "#7A1F2B",
    accentInk: "#FFFFFF",
    motto: "Aeterna non caduca",
    address: "Falcon St, Crows Nest NSW 2065",
    shopHours: "Mon & Thu · 8:15am – 1:30pm",
    shopEmail: "uniformshop@nsbh.nsw.edu.au",
  },
  rgsh: {
    id: "rgsh",
    name: "Riverside Girls High School",
    short: "RGHS",
    accent: "#2F5D50",
    accentInk: "#FFFFFF",
    motto: "Per ardua ad astra",
    address: "Huntleys Point Rd, Huntleys Point NSW 2111",
    shopHours: "Tue & Fri · 8:00am – 1:00pm",
    shopEmail: "uniformshop@rghs.nsw.edu.au",
  },
};

export type ItemCategory = "Summer" | "Winter" | "Sports" | "Formal" | "Bags" | "Stationery";

export interface ItemVariant {
  label: string;
  price: number;
  sizes: string[];
}

export interface SizeGuide {
  unit: string;
  cols: string[];
  rows: string[][];
}

export interface CatalogItem {
  id: string;
  cat: ItemCategory;
  name: string;
  desc?: string;
  variants: ItemVariant[];
  sizeGuide?: SizeGuide;
}

const SIZES_GENERIC = ["10", "12", "14", "16", "18", "20", "22", "24", "26"];

export const CATALOG: CatalogItem[] = [
  {
    id: "shirt-ss",
    cat: "Summer",
    name: "White Shirt — Short Sleeves",
    desc: "Embroidered school crest. Poly-cotton blend, machine wash cold.",
    variants: [
      { label: "Boys 10–26", price: 32, sizes: SIZES_GENERIC },
      { label: "Mens 4–8", price: 43, sizes: ["4", "5", "6", "7", "8"] },
    ],
    sizeGuide: {
      unit: "cm",
      cols: ["Size", "Chest", "Length"],
      rows: [
        ["10", "78", "62"], ["12", "82", "64"], ["14", "86", "66"], ["16", "90", "68"],
        ["18", "94", "70"], ["20", "98", "72"], ["22", "102", "74"], ["24", "106", "76"],
        ["26", "110", "78"],
      ],
    },
  },
  {
    id: "cap",
    cat: "Summer",
    name: "School Cap, Navy",
    desc: "Embroidered NSBH crest. One size, adjustable strap.",
    variants: [{ label: "One size", price: 17, sizes: ["OS"] }],
  },
  {
    id: "sock-white",
    cat: "Summer",
    name: "White Sport Socks (cotton blend, midi)",
    desc: "Pack of one pair.",
    variants: [
      { label: "3–9", price: 5, sizes: ["3-9"] },
      { label: "7–11", price: 5, sizes: ["7-11"] },
    ],
  },
  {
    id: "shirt-ls",
    cat: "Winter",
    name: "White Shirt — Long Sleeves",
    desc: "Embroidered school crest. Poly-cotton blend.",
    variants: [
      { label: "Boys 10–24", price: 28, sizes: ["10", "12", "14", "16", "18", "20", "22", "24"] },
      { label: "Mens 5–8", price: 59, sizes: ["5", "6", "7", "8"] },
    ],
    sizeGuide: {
      unit: "cm",
      cols: ["Size", "Chest", "Sleeve"],
      rows: [
        ["10", "80", "58"], ["12", "84", "60"], ["14", "88", "62"], ["16", "92", "64"],
        ["18", "96", "66"], ["20", "100", "68"], ["22", "104", "70"], ["24", "108", "72"],
      ],
    },
  },
  {
    id: "jumper",
    cat: "Winter",
    name: "Jumper — Wool Blend, Crested",
    desc: "V-neck pullover with embroidered school crest.",
    variants: [
      { label: "12–16", price: 75, sizes: ["12", "14", "16"] },
      { label: "18–22", price: 77, sizes: ["18", "20", "22"] },
      { label: "24–26", price: 82, sizes: ["24", "26"] },
    ],
  },
  {
    id: "trousers",
    cat: "Winter",
    name: "Trousers — Mid Grey, Pleated Front",
    desc: "Poly/viscose blend with adjustable waist.",
    variants: [
      { label: "Year 7–10 short (127cm)", price: 17, sizes: ["7-10S"] },
      { label: "Year 7–10 long (137cm)", price: 18, sizes: ["7-10L"] },
      { label: "Year 11–12 short (137cm)", price: 17, sizes: ["11-12S"] },
      { label: "Year 11–12 long (147cm)", price: 18, sizes: ["11-12L"] },
    ],
  },
  {
    id: "belt",
    cat: "Winter",
    name: "Belt — Black Leather, Silver Buckle",
    variants: [{ label: "70–95cm", price: 15, sizes: ["70", "75", "80", "85", "90", "95"] }],
  },
  {
    id: "jacket",
    cat: "Winter",
    name: "Jacket — Navy with Zip",
    variants: [{ label: "12–3XL", price: 100, sizes: ["12", "14", "16", "18", "L", "XL", "XXL", "3XL"] }],
  },
  {
    id: "tie",
    cat: "Winter",
    name: "School Tie — Navy Crested",
    variants: [{ label: "One size", price: 20, sizes: ["OS"] }],
  },
  {
    id: "polo",
    cat: "Sports",
    name: "Sports Polo Shirt",
    desc: "Breathable mesh weave with embroidered crest.",
    variants: [{ label: "10–26", price: 40, sizes: SIZES_GENERIC }],
  },
  {
    id: "shorts-sport",
    cat: "Sports",
    name: "Sports Shorts",
    variants: [{ label: "12–24", price: 30, sizes: ["12", "14", "16", "18", "20", "22", "24"] }],
  },
  {
    id: "hoodie",
    cat: "Sports",
    name: "Navy Hoodie",
    variants: [{ label: "12–XXL", price: 47, sizes: ["12", "14", "16", "18", "20", "L", "XL", "XXL"] }],
  },
  {
    id: "tracks",
    cat: "Sports",
    name: "Track Pants",
    variants: [
      { label: "12–16", price: 43, sizes: ["12", "14", "16"] },
      { label: "18–26", price: 45, sizes: ["18", "20", "22", "24", "26"] },
    ],
  },
  {
    id: "sock-sport",
    cat: "Sports",
    name: "Sports Socks (soccer / hockey / rugby)",
    variants: [{ label: "2–7 / 7–11 / XL", price: 12, sizes: ["2-7", "7-11", "XL"] }],
  },
  {
    id: "blazer",
    cat: "Formal",
    name: "Blazer — Crested",
    desc: "Wool-blend, fully lined, embroidered pocket crest.",
    variants: [
      { label: "88–95cm chest", price: 185, sizes: ["88", "92", "95"] },
      { label: "100–115cm chest", price: 210, sizes: ["100", "105", "110", "115"] },
    ],
  },
  {
    id: "backpack",
    cat: "Bags",
    name: "School Backpack — Navy with Crest",
    variants: [{ label: "One size", price: 89, sizes: ["OS"] }],
  },
  {
    id: "sportsbag",
    cat: "Bags",
    name: "Sports Bag — Maroon with Crest",
    variants: [
      { label: "Small", price: 39, sizes: ["S"] },
      { label: "Large", price: 46, sizes: ["L"] },
    ],
  },
  {
    id: "calc",
    cat: "Stationery",
    name: "Scientific Calculator",
    variants: [{ label: "N/A", price: 33, sizes: ["OS"] }],
  },
  {
    id: "mathset",
    cat: "Stationery",
    name: "Math Set",
    variants: [{ label: "N/A", price: 7, sizes: ["OS"] }],
  },
];

export const CATEGORIES: ItemCategory[] = ["Summer", "Winter", "Sports", "Formal", "Bags", "Stationery"];

export interface CartLine {
  itemId: string;
  variantLabel: string;
  size: string;
  qty: number;
  price: number;
  name: string;
}

// Riley's saved cart (matches the paper form to make the demo feel real).
export const SAMPLE_CART: CartLine[] = [
  { itemId: "shirt-ls", variantLabel: "Boys 10–24", size: "16", qty: 2, price: 28, name: "White Shirt — Long Sleeves" },
  { itemId: "jumper", variantLabel: "12–16", size: "16", qty: 1, price: 75, name: "Jumper — Wool Blend, Crested" },
  { itemId: "trousers", variantLabel: "Year 7–10 long (137cm)", size: "7-10L", qty: 1, price: 18, name: "Trousers — Mid Grey" },
  { itemId: "tracks", variantLabel: "18–26", size: "20", qty: 1, price: 45, name: "Track Pants" },
  { itemId: "polo", variantLabel: "10–26", size: "16", qty: 1, price: 40, name: "Sports Polo Shirt" },
  { itemId: "sportsbag", variantLabel: "Large", size: "L", qty: 1, price: 46, name: "Sports Bag — Maroon" },
];

export interface PastOrder {
  id: string;
  date: string;
  kid: string;
  school: TenantId;
  total: number;
  items: number;
  status: "collected" | "ready" | "packing" | "new";
}

export const PAST_ORDERS: PastOrder[] = [
  { id: "NSBH-04231", date: "14 Jan 2026", kid: "Riley", school: "nsbh", total: 286, items: 6, status: "collected" },
  { id: "NSBH-04102", date: "03 Dec 2025", kid: "Riley", school: "nsbh", total: 124, items: 3, status: "collected" },
  { id: "RGHS-01880", date: "22 Jan 2026", kid: "Mia", school: "rgsh", total: 218, items: 5, status: "collected" },
];

export interface Kid {
  name: string;
  year: string;
  tenantId: TenantId;
}

export const PARENT = {
  name: "George Qiao",
  email: "george.qiao@gmail.com",
  kids: [
    { name: "Riley", year: "Year 9", tenantId: "nsbh" as TenantId },
    { name: "Mia", year: "Year 7", tenantId: "rgsh" as TenantId },
  ] satisfies Kid[],
};

export function getItem(id: string): CatalogItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.price * l.qty, 0);
}
