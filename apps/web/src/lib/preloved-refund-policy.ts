/**
 * ACL-safe preloved refund clause.
 * Pure text helpers only — persist via insertNextTenantLegalVersion, never
 * UPDATE tenant_legal_versions from this module.
 */

/** Canonical paragraph for generic + tenant refund-policy pages and demo fixtures. */
export const PRELOVED_REFUND_CLAUSE =
  "Preloved items are sold as worn, at a reduced price, with the stated condition. Change of mind is not offered. If an item is not as described, or is not of acceptable quality for a used garment at that price, the shop will repair, replace, or refund as Australian Consumer Law requires.";

function normalizePolicyWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** True when stored policy text already includes the canonical preloved clause. */
export function policyTextContainsPrelovedRefundClause(policyText: string): boolean {
  const haystack = normalizePolicyWhitespace(policyText);
  if (!haystack) return false;
  return haystack.includes(normalizePolicyWhitespace(PRELOVED_REFUND_CLAUSE));
}

/**
 * Policy text to persist on a tenant_legal_versions row when preloved is on.
 * Idempotent: returns stored text unchanged when the clause is already present.
 */
export function policyTextWithPrelovedRefundClause(
  policyText: string | null | undefined,
): string {
  const stored = policyText ?? "";
  if (policyTextContainsPrelovedRefundClause(stored)) return stored;
  if (!stored.trim()) return PRELOVED_REFUND_CLAUSE;
  return `${stored.trimEnd()}\n\n${PRELOVED_REFUND_CLAUSE}`;
}

/**
 * Parent-facing policy text. Persistence may already have written the clause
 * onto tenant_legal_versions. If preloved is on and the stored text still
 * lacks it (tenant enabled before M04, or never re-saved settings), append
 * at display time so the page still meets ACL copy.
 */
export function displayRefundPolicyText(
  policyText: string | null | undefined,
  prelovedEnabled?: boolean,
): string {
  const stored = policyText ?? "";
  if (!prelovedEnabled) return stored;
  return policyTextWithPrelovedRefundClause(stored);
}
