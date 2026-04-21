import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

// Re-use connection across hot-reloads in development
const globalForDb = globalThis as unknown as { sql: ReturnType<typeof postgres> };

export const sql =
  globalForDb.sql ??
  postgres(connectionString, {
    ssl: "require",
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: 60 * 10,
    // Kill any query that runs longer than 15 seconds
    connection: { statement_timeout: 15000 },
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;
