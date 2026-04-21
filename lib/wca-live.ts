/**
 * Fetches personal records from WCA Live for ongoing competitions
 * (competitions that have not yet been exported to the official WCA database).
 *
 * All errors are caught and return an empty array so the page degrades
 * gracefully when WCA Live is unavailable.
 */

import type { PersonPRs, PR, RankMap } from "./queries";

const WCA_LIVE_API = "https://live.worldcubeassociation.org/api";
const FETCH_TIMEOUT_MS = 8_000;

async function graphql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(WCA_LIVE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      next: { revalidate: 300 }, // cache 5 minutes
    });
    if (!res.ok) throw new Error(`WCA Live HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}

// ─── GraphQL types ─────────────────────────────────────────────────────────

interface GqlCompetition {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
}

interface GqlResult {
  ranking: number;
  best: number;
  average: number;
  single_record_tag: string | null;
  average_record_tag: string | null;
  person: {
    wca_id: string | null;
    name: string;
    country: { iso2: string } | null;
  };
}

interface GqlRound {
  results: GqlResult[];
}

interface GqlEvent {
  id: string;
  rounds: GqlRound[];
}

interface GqlCompetitionDetail {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  competition_events: { event: { id: string }; rounds: GqlRound[] }[];
}

// ─── Queries ───────────────────────────────────────────────────────────────

const COMPETITIONS_QUERY = `
  query RecentCompetitions($from: Date) {
    competitions(from: $from) {
      id
      name
      start_date
      end_date
    }
  }
`;

const COMPETITION_RESULTS_QUERY = `
  query CompetitionResults($id: ID!) {
    competition(id: $id) {
      id
      name
      start_date
      end_date
      competition_events {
        event { id }
        rounds {
          results {
            ranking
            best
            average
            single_record_tag
            average_record_tag
            person {
              wca_id
              name
              country { iso2 }
            }
          }
        }
      }
    }
  }
`;

// ─── Helpers ───────────────────────────────────────────────────────────────

function isoDateMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function addLivePR(
  map: Map<string, PersonPRs>,
  wcaId: string,
  name: string,
  pr: PR
): void {
  if (!map.has(wcaId)) {
    map.set(wcaId, { personId: wcaId, personName: name, prs: [] });
  }
  map.get(wcaId)!.prs.push(pr);
}

// ─── Main export ───────────────────────────────────────────────────────────

export async function fetchLivePRs(
  days: number,
  knownCompetitionIds: Set<string>,
  ranks: RankMap
): Promise<PersonPRs[]> {
  const from = isoDateMinus(days);

  let competitions: GqlCompetition[];
  try {
    const data = await graphql<{ competitions: GqlCompetition[] }>(
      COMPETITIONS_QUERY,
      { from }
    );
    competitions = data.competitions ?? [];
  } catch {
    return [];
  }

  // Only competitions not yet in our local DB (those are already served from the cache)
  const liveComps = competitions.filter(
    (c) => !knownCompetitionIds.has(c.id)
  );

  if (liveComps.length === 0) return [];

  const personMap = new Map<string, PersonPRs>();

  await Promise.all(
    liveComps.map(async (comp) => {
      let detail: GqlCompetitionDetail;
      try {
        const data = await graphql<{ competition: GqlCompetitionDetail }>(
          COMPETITION_RESULTS_QUERY,
          { id: comp.id }
        );
        detail = data.competition;
      } catch {
        return;
      }
      if (!detail) return;

      for (const ce of detail.competition_events) {
        const eventId = ce.event.id;
        // Use the last round available (most recent = closest to final)
        const lastRound = ce.rounds[ce.rounds.length - 1];
        if (!lastRound) continue;

        for (const result of lastRound.results) {
          const { wca_id: wcaId, name, country } = result.person;
          if (!wcaId || country?.iso2 !== "CH") continue;

          // Single PR check
          if (result.best > 0) {
            const key = `${wcaId}:${eventId}`;
            const dbBest = ranks.single.get(key);
            if (!dbBest || result.best <= dbBest) {
              addLivePR(personMap, wcaId, name, {
                eventId,
                competitionId: comp.id,
                competitionName: comp.name,
                cityName: "",
                endDate: comp.end_date ?? comp.start_date,
                type: "single",
                time: result.best,
                wr: null,
                cr: null,
                nr: null,
                regionalRecord: result.single_record_tag ?? null,
                isLive: true,
              });
            }
          }

          // Average PR check
          if (result.average > 0) {
            const key = `${wcaId}:${eventId}`;
            const dbAvgBest = ranks.average.get(key);
            if (!dbAvgBest || result.average <= dbAvgBest) {
              addLivePR(personMap, wcaId, name, {
                eventId,
                competitionId: comp.id,
                competitionName: comp.name,
                cityName: "",
                endDate: comp.end_date ?? comp.start_date,
                type: "average",
                time: result.average,
                wr: null,
                cr: null,
                nr: null,
                regionalRecord: result.average_record_tag ?? null,
                isLive: true,
              });
            }
          }
        }
      }
    })
  );

  return Array.from(personMap.values()).filter((p) => p.prs.length > 0);
}
