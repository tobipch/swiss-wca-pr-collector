/**
 * Creates all required tables in the database.
 * Run once before the first import: npm run db:setup
 */
import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");

const sql = postgres(DATABASE_URL, { ssl: "require", onnotice: () => {} });

async function main() {
  console.log("Creating tables...");

  await sql`
    CREATE TABLE IF NOT EXISTS competitions (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      city_name  TEXT,
      country_id TEXT,
      start_date DATE,
      end_date   DATE
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS results (
      id                       SERIAL PRIMARY KEY,
      competition_id           TEXT NOT NULL,
      event_id                 TEXT NOT NULL,
      round_type_id            TEXT,
      pos                      INTEGER,
      best                     INTEGER DEFAULT 0,
      average                  INTEGER DEFAULT 0,
      person_name              TEXT,
      person_id                TEXT,
      person_country_id        TEXT,
      format_id                TEXT,
      regional_single_record   TEXT,
      regional_average_record  TEXT
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_results_competition
      ON results (competition_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_results_person
      ON results (person_id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_results_country_event
      ON results (person_country_id, event_id)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS persons (
      wca_id     TEXT,
      sub_id     INTEGER,
      name       TEXT NOT NULL,
      country_id TEXT,
      PRIMARY KEY (wca_id, sub_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ranks_single (
      person_id      TEXT NOT NULL,
      event_id       TEXT NOT NULL,
      best           INTEGER NOT NULL,
      world_rank     INTEGER,
      continent_rank INTEGER,
      country_rank   INTEGER,
      PRIMARY KEY (person_id, event_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS ranks_average (
      person_id      TEXT NOT NULL,
      event_id       TEXT NOT NULL,
      best           INTEGER NOT NULL,
      world_rank     INTEGER,
      continent_rank INTEGER,
      country_rank   INTEGER,
      PRIMARY KEY (person_id, event_id)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS import_metadata (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS pr_cache (
      days        INTEGER PRIMARY KEY,
      result      JSONB NOT NULL,
      computed_at TIMESTAMP DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_competitions_end_date
      ON competitions (end_date)
  `;

  console.log("All tables created successfully.");
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
