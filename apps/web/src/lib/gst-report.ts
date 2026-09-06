import type { LiveGstRow } from "@/db/queries";

export type GstReportRow = LiveGstRow;

export const GST_REPORT_HEADERS = [
  "Period",
  "Gross sales",
  "Taxable sales",
  "GST-free preloved",
  "GST collected",
  "Net (ex-GST)",
  "Stripe fees",
  "Net payout",
] as const;
