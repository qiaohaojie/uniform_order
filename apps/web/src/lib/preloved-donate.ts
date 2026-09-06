/**
 * Parent drop-off bag-note types and limits.
 * A message to operators — not a listing or payment.
 * This module must not import the DB client.
 */

export const MIN_DONATION_BAG_COUNT = 1;
export const MAX_DONATION_BAG_COUNT = 20;

export type InsertDonationNoteInput = {
  tenantId: string;
  parentName: string;
  studentName: string;
  bagCount: number;
};
