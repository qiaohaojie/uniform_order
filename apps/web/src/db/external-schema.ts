// Foreign-managed schema (Neon Auth). Declared here, not in schema.ts,
// so drizzle-kit doesn't track it for migrations — drizzle-kit only
// enumerates exports of the file pointed to by drizzle.config.ts.
// schema.ts imports neonAuthUsers for FK-reference type resolution
// without re-exporting it. See docs/remaining_work.md §4.11.
import { pgSchema, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const neonAuthSchema = pgSchema("neon_auth");

export const neonAuthUsers = neonAuthSchema.table("user", {
  id: uuid("id").primaryKey(),
  name: text("name"),
  email: text("email"),
  emailVerified: boolean("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
