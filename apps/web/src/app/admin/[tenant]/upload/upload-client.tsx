"use client";
import { useState, useRef } from "react";
import type { Tenant } from "@/lib/data";
import { Chip } from "@/components/chip";

interface PreviewRow {
  i: number;
  sku: string;
  name: string;
  cat: string;
  variant: string;
  sizes: string;
  price: string;
  status: "add" | "update" | "error";
  errs?: { sku?: boolean; price?: boolean };
}

const DEMO_ROWS: PreviewRow[] = [
  { i: 1, sku: "SHIRT-SS-B", name: "White Shirt — Short Sleeves", cat: "Summer", variant: "Boys 10–26", sizes: "10,12,14,16,18,20,22,24,26", price: "32.00", status: "update" },
  { i: 2, sku: "SHIRT-SS-M", name: "White Shirt — Short Sleeves", cat: "Summer", variant: "Mens 4–8", sizes: "4,5,6,7,8", price: "43.00", status: "update" },
  { i: 3, sku: "JUMPER-NEW", name: "Jumper — Merino Wool, Crested", cat: "Winter", variant: "12–26", sizes: "12,14,16,18,20,22,24,26", price: "95.00", status: "add" },
  { i: 4, sku: "POLO-NEW", name: "Sports Polo Shirt (New Design)", cat: "Sports", variant: "10–26", sizes: "10,12,14,16,18,20,22,24,26", price: "42.00", status: "add" },
  { i: 5, sku: "TRACK-NEW", name: "Track Pants (New Design)", cat: "Sports", variant: "10–26", sizes: "10,12,14,16,18,20,22,24,26", price: "47.00", status: "add" },
  { i: 6, sku: "", name: "Blazer — Crested (Updated)", cat: "Formal", variant: "88–115cm", sizes: "88,92,95,100,105,110,115", price: "free", status: "error", errs: { sku: true, price: true } },
  { i: 7, sku: "CAP-OS", name: "School Cap, Navy", cat: "Summer", variant: "One size", sizes: "OS", price: "18.00", status: "update" },
  { i: 8, sku: "SOCK-W", name: "White Sport Socks", cat: "Summer", variant: "3–9", sizes: "3-9", price: "5.00", status: "update" },
  { i: 9, sku: "", name: "New Bag Style", cat: "Bags", variant: "One size", sizes: "OS", price: "99.00", status: "error", errs: { sku: true } },
];

export function UploadClient({ tenant }: { tenant: Tenant }) {
  const [stage, setStage] = useState<"idle" | "preview" | "done">("idle");
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    setRows(DEMO_ROWS);
    setStage("preview");
  };

  const handleFileChange = () => {
    setRows(DEMO_ROWS);
    setStage("preview");
  };

  const handleImport = () => {
    const validRows = rows.filter((r) => r.status !== "error");
    setRows(validRows);
    setStage("done");
  };

  const adds = rows.filter((r) => r.status === "add").length;
  const updates = rows.filter((r) => r.status === "update").length;
  const errors = rows.filter((r) => r.status === "error").length;

  return (
    <div className="flex-1 overflow-y-auto p-7">
      {stage === "idle" && (
        <div className="max-w-2xl mx-auto">
          {/* Instructions */}
          <div
            className="bg-white rounded-xl border p-6 mb-5"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <h2 className="font-serif text-[18px] font-medium mb-3" style={{ color: "var(--color-ink)" }}>
              CSV format
            </h2>
            <p className="text-[13px] leading-[1.6] mb-4" style={{ color: "var(--color-ink-dim)" }}>
              Upload a CSV file to add or update products in bulk. Required columns: <b>sku</b>, <b>name</b>, <b>category</b>, <b>variant_label</b>, <b>sizes</b>, <b>price</b>.
            </p>
            <div
              className="rounded-lg p-3 font-mono text-[11.5px] leading-[1.8]"
              style={{ background: "var(--color-parchment)", color: "var(--color-ink)" }}
            >
              sku,name,category,variant_label,sizes,price<br />
              SHIRT-SS-B,White Shirt — Short Sleeves,Summer,Boys 10–26,&quot;10,12,14,16&quot;,32.00<br />
              JUMPER-NEW,Jumper — Merino Wool,Winter,12–26,&quot;12,14,16,18&quot;,95.00
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors"
            style={{
              borderColor: dragging ? tenant.accent : "var(--color-rule)",
              background: dragging ? `${tenant.accent}08` : "#fff",
            }}
          >
            <div
              className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "var(--color-parchment)" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-dim)" strokeWidth="1.7" strokeLinecap="round">
                <path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="font-semibold text-[14px] mb-1" style={{ color: "var(--color-ink)" }}>
              Drop your CSV here, or click to browse
            </div>
            <div className="text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
              .csv files only · max 5 MB
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Demo button */}
          <div className="text-center mt-4">
            <button
              onClick={() => { setRows(DEMO_ROWS); setStage("preview"); }}
              className="text-[12px] underline"
              style={{ color: tenant.accent }}
            >
              Load demo CSV to preview
            </button>
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div className="flex flex-col gap-4">
          {/* Summary bar */}
          <div
            className="flex items-center gap-4 p-3.5 rounded-xl border"
            style={{ background: "#fff", borderColor: "var(--color-rule)" }}
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: errors > 0 ? "#B23A2A" : "var(--color-success)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round">
                {errors > 0 ? (
                  <>
                    <path d="M12 3 L22 20 H2 Z" />
                    <path d="M12 10 V14" />
                    <circle cx="12" cy="17" r="0.6" fill="#fff" stroke="none" />
                  </>
                ) : (
                  <path d="M5 13 L10 18 L20 6" />
                )}
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold" style={{ color: "var(--color-ink)" }}>
                {errors > 0 ? `${errors} rows have errors` : "All rows valid"}
              </div>
              <div className="text-[12px]" style={{ color: "var(--color-ink-dim)" }}>
                {errors > 0 ? "Fix or skip them before importing. Edit cells inline below." : "Ready to import."}
              </div>
            </div>
            <div
              className="bg-white border rounded-lg p-2.5 text-[12px]"
              style={{ borderColor: "var(--color-rule)" }}
            >
              <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] mb-1" style={{ color: "var(--color-ink-dim)" }}>Summary</div>
              <div className="flex gap-3">
                <span><b className="font-serif text-[16px]">{adds}</b> add</span>
                <span><b className="font-serif text-[16px]">{updates}</b> update</span>
                <span style={{ color: "#B23A2A" }}><b className="font-serif text-[16px]">{errors}</b> error</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStage("idle")}
                className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border"
                style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md text-white"
                style={{ background: tenant.accent }}
              >
                Import {adds + updates} rows
              </button>
            </div>
          </div>

          {/* Preview table */}
          <div
            className="bg-white rounded-xl border overflow-hidden"
            style={{ borderColor: "var(--color-rule)" }}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12.5px]" style={{ fontFamily: "var(--font-sans)" }}>
                <thead>
                  <tr style={{ background: "var(--color-parchment)" }}>
                    {["#", "SKU", "Product", "Cat", "Variant", "Sizes", "Price", "Action"].map((h, i) => (
                      <th
                        key={h}
                        className="text-left py-2.5 px-3 text-[10.5px] font-bold uppercase tracking-[0.6px] border-b"
                        style={{
                          color: "var(--color-ink-dim)",
                          borderColor: "var(--color-rule)",
                          textAlign: i === 6 ? "right" : "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const bad = r.status === "error";
                    return (
                      <tr
                        key={r.i}
                        className="border-b"
                        style={{
                          borderColor: "var(--color-rule)",
                          background: bad ? "#FDF1ED" : "#fff",
                        }}
                      >
                        <td className="py-2.5 px-3 font-mono text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                          {r.i}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11.5px] font-semibold">
                          {r.errs?.sku ? (
                            <span
                              className="inline-flex items-center gap-1.5"
                              style={{ color: "#B23A2A" }}
                            >
                              <span style={{ borderBottom: "2px wavy #B23A2A", paddingBottom: 1 }}>
                                (empty)
                              </span>
                            </span>
                          ) : (
                            <span style={{ color: "var(--color-ink)" }}>{r.sku}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium" style={{ color: "var(--color-ink)" }}>
                          {r.name}
                        </td>
                        <td className="py-2.5 px-3">
                          <Chip tone="neutral" size="sm">{r.cat}</Chip>
                        </td>
                        <td className="py-2.5 px-3" style={{ color: "var(--color-ink-dim)" }}>
                          {r.variant}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]" style={{ color: "var(--color-ink-dim)" }}>
                          {r.sizes}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold tnum">
                          {r.errs?.price ? (
                            <span style={{ color: "#B23A2A", borderBottom: "2px wavy #B23A2A" }}>
                              {r.price}
                            </span>
                          ) : (
                            <span style={{ color: "var(--color-ink)" }}>${r.price}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {r.status === "add" && <Chip tone="success" size="sm">+ Add</Chip>}
                          {r.status === "update" && <Chip tone="info" size="sm">Update</Chip>}
                          {r.status === "error" && <Chip tone="danger" size="sm">Fix needed</Chip>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {errors > 0 && (
              <div
                className="px-3.5 py-2.5 flex items-center gap-3 text-[12px]"
                style={{ background: "#FDF1ED", borderTop: "1px solid var(--color-rule)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#B23A2A" strokeWidth="1.7" strokeLinecap="round">
                  <path d="M12 3 L22 20 H2 Z" /><path d="M12 10 V14" />
                  <circle cx="12" cy="17" r="0.6" fill="#B23A2A" stroke="none" />
                </svg>
                <span style={{ color: "var(--color-ink)" }}>
                  <b>Row 6 · Price</b> "free" must be a number with two decimals (e.g.{" "}
                  <code
                    className="font-mono rounded px-1"
                    style={{ background: "#fff" }}
                  >
                    45.00
                  </code>
                  ).
                </span>
                <span className="w-px h-3.5" style={{ background: "#E5BDB4" }} />
                <span style={{ color: "var(--color-ink)" }}>
                  <b>Rows 6, 9 · SKU</b> required for all new products.
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => setRows((prev) => prev.filter((r) => r.status !== "error"))}
                  className="text-[11.5px] font-semibold"
                  style={{ color: "var(--color-ink-dim)" }}
                >
                  Skip errored rows
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === "done" && (
        <div className="max-w-lg mx-auto text-center pt-16">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: "var(--color-success)", color: "#fff" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M5 13 L10 18 L20 6" />
            </svg>
          </div>
          <h2 className="font-serif text-[24px] font-medium mb-2" style={{ color: "var(--color-ink)" }}>
            Import complete
          </h2>
          <p className="text-[13px] leading-[1.6] mb-6" style={{ color: "var(--color-ink-dim)" }}>
            {adds + updates} products have been added or updated in the catalog.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setStage("idle")}
              className="h-9 px-4 text-[13px] font-semibold rounded-md border"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              Upload another file
            </button>
            <a
              href={`/admin/${tenant.id}/catalog`}
              className="h-9 px-4 text-[13px] font-semibold rounded-md text-white flex items-center"
              style={{ background: tenant.accent }}
            >
              View catalog →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
