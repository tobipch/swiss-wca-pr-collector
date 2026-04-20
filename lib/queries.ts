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
}

export async function fetchPRs(days: number): Promise<PersonPRs[]> {
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
      AND c.end_date >= CURRENT_DATE - (${days} || ' days')::interval
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
        regionalRecord: row.regional_single_record,
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
        regionalRecord: row.regional_average_record,
      });
    }
  }

  // Remove persons with no PRs (shouldn't happen, but safety net)
  return [...map.values()].filter((p) => p.prs.length > 0);
}
