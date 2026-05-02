import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type DbClient = NeonHttpDatabase<typeof schema>;

let dbClient: DbClient | null = null;

export function getDb(): DbClient {
  if (dbClient) return dbClient;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const sql = neon(databaseUrl);
  dbClient = drizzle(sql, { schema });
  return dbClient;
}

export const db = new Proxy({} as DbClient, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export * from "./schema";
