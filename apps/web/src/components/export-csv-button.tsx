"use client";

export interface CsvRow {
  period: string;
  gross: number;
  gst: number;
  net: number;
  fees: number;
  payout: number;
}

export function ExportCsvButton({
  rows,
  filename = "report.csv",
}: {
  rows: CsvRow[];
  filename?: string;
}) {
  const handleExport = () => {
    const headers = ["Period", "Gross sales", "GST collected", "Net (ex-GST)", "Stripe fees", "Net payout"];
    const lines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.period,
          r.gross.toFixed(2),
          r.gst.toFixed(2),
          r.net.toFixed(2),
          r.fees.toFixed(2),
          r.payout.toFixed(2),
        ].join(",")
      ),
    ];
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="h-9 px-3.5 text-[12.5px] font-semibold rounded-md border flex items-center gap-1.5"
      style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      >
        <path d="M21 15 V19 a2 2 0 0 1 -2 2 H5 a2 2 0 0 1 -2 -2 V15" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Export CSV
    </button>
  );
}
