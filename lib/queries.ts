import { sql } from "./db";

export interface PRRow {
  person_id: string;
  person_name: string;
  event_id: string;
  competition_id: string;
  competition_name: string;
  city_name: string;
  end_date: string;
  best: number;
  average: number;
  regional_single_record: string | null;
  regional_average_record: string | null;
  single_wr: number | null;
  single_cr: number | null;
  single_nr: number | null;
  avg_wr: number | null;
  avg_cr: number | null;
  avg_nr: number | null;
  is_single_pr: boolean;
  is_avg_pr: boolean;
}

export interface PersonPRs {
  personId: string;
  personName: string;
  prs: PR[];
}

export interface PR {
  eventId: string;
  competitionId: string;
  competitionName: string;
  cityName: string;
  endDate: string;
  type: "single" | "average";
  time: number;
  wr: number | null;
  cr: number | null;
  nr: number | null;
  regionalRecord: string | null;
  isLive?: boolean;
}

// Read pre-computed results from pr_cache — populated by the import script
export async function fetchPRs(days: number): Promise<PersonPRs[]> {
  const rows = await sql<{ result: PersonPRs[] }[]>`
    SELECT result FROM pr_cache WHERE days = ${days}
  `;
  return rows[0]?.result ?? [];
}

// Full SQL query used by the import script to build the cache
export async function fetchPRsImpl(days: number): Promise<PersonPRs[]> {
  const rows = await sql<PRRow[]>`
    SELECT
      r.person_id,
      r.person_name,
      r.event_id,
      r.competition_id,
      c.name            AS competition_name,
      c.city_name,
      c.end_date::text  AS end_date,
      r.best,
      r.average,
      r.regional_single_record,
      r.regional_average_record,
      rs.world_rank     AS single_wr,
      rs.continent_rank AS single_cr,
      rs.country_rank   AS single_nr,
      ra.world_rank     AS avg_wr,
      ra.continent_rank AS avg_cr,
      ra.country_rank   AS avg_nr,
      (r.best > 0 AND rs.best IS NOT NULL AND r.best = rs.best)       AS is_single_pr,
      (r.average > 0 AND ra.best IS NOT NULL AND r.average = ra.best) AS is_avg_pr
    FROM results r
    JOIN competitions c ON r.competition_id = c.id
    LEFT JOIN ranks_single rs
           ON r.person_id = rs.person_id AND r.event_id = rs.event_id
    LEFT JOIN ranks_average ra
           ON r.person_id = ra.person_id AND r.event_id = ra.event_id
    WHERE
      r.person_country_id = 'Switzerland'
      AND c.end_date >= CURRENT_DATE - (${days} * interval '1 day')
      AND c.end_date <= CURRENT_DATE + interval '1 day'
      AND (
        (r.best > 0 AND rs.best IS NOT NULL AND r.best = rs.best)
        OR
        (r.average > 0 AND ra.best IS NOT NULL AND r.average = ra.best)
      )
    ORDER BY c.end_date DESC, r.person_name, r.event_id
  `;

  return groupByPerson(rows);
}

export async function getImportDate(): Promise<string | null> {
  try {
    const rows = await sql<{ value: string }[]>`
      SELECT value FROM import_metadata WHERE key = 'imported_at'
    `;
    return rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export interface RankMap {
  single: Map<string, number>;   // "personId:eventId" → best
  average: Map<string, number>;
}

export async function getAllSwissRanks(): Promise<RankMap> {
  const [singles, averages] = await Promise.all([
    sql<{ person_id: string; event_id: string; best: number }[]>`
      SELECT person_id, event_id, best FROM ranks_single
    `,
    sql<{ person_id: string; event_id: string; best: number }[]>`
      SELECT person_id, event_id, best FROM ranks_average
    `,
  ]);
  const single = new Map<string, number>();
  const average = new Map<string, number>();
  for (const r of singles) single.set(`${r.person_id}:${r.event_id}`, r.best);
  for (const r of averages) average.set(`${r.person_id}:${r.event_id}`, r.best);
  return { single, average };
}

export async function getDbCompetitionIds(): Promise<Set<string>> {
  // Only competitions with actual results are considered "in the DB".
  // A competition row may exist before results are imported, so filtering
  // by the results table prevents us from skipping live data for competitions
  // that are registered but not yet fully exported.
  const rows = await sql<{ competition_id: string }[]>`
    SELECT DISTINCT competition_id FROM results
  `;
  return new Set(rows.map((r) => r.competition_id));
}

function nullStr(val: string | null): string | null {
  if (!val || val === "NULL") return null;
  return val;
}

function groupByPerson(rows: PRRow[]): PersonPRs[] {
  const map = new Map<string, PersonPRs>();

  for (const row of rows) {
    if (!map.has(row.person_id)) {
      map.set(row.person_id, {
        personId: row.person_id,
        personName: row.person_name,
        prs: [],
      });
    }
    const person = map.get(row.person_id)!;

    if (row.is_single_pr && row.best > 0) {
      person.prs.push({
        eventId: row.event_id,
        competitionId: row.competition_id,
        competitionName: row.competition_name,
        cityName: row.city_name,
        endDate: row.end_date,
        type: "single",
        time: row.best,
        wr: row.single_wr,
        cr: row.single_cr,
        nr: row.single_nr,
        regionalRecord: nullStr(row.regional_single_record),
      });
    }

    if (row.is_avg_pr && row.average > 0) {
      person.prs.push({
        eventId: row.event_id,
        competitionId: row.competition_id,
        competitionName: row.competition_name,
        cityName: row.city_name,
        endDate: row.end_date,
        type: "average",
        time: row.average,
        wr: row.avg_wr,
        cr: row.avg_cr,
        nr: row.avg_nr,
        regionalRecord: nullStr(row.regional_average_record),
      });
    }
  }

  return [...map.values()]
    .filter((p) => p.prs.length > 0)
    .sort((a, b) => {
      const minNr = (p: PersonPRs) =>
        Math.min(...p.prs.map((pr) => pr.nr ?? Infinity));
      return minNr(a) - minNr(b);
    });
}
