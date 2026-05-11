/**
 * Detect Postgres unique-constraint violations (SQLSTATE 23505) from any
 * thrown error originating in the neon-http driver. Optionally narrow on a
 * specific constraint name (matches `pgError.constraint`).
 */
export function isUniqueConstraintError(error: unknown, constraintName?: string) {
  const pgError = error as { code?: string; constraint?: string };
  if (pgError?.code !== "23505") return false;
  if (!constraintName) return true;
  return pgError.constraint === constraintName;
}
