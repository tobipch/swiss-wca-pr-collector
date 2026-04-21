/**
 * Temporary debug endpoint — remove once WCA Live integration is confirmed working.
 * Visit /api/debug-live?days=30 (or ?days=90 etc.)
 */

import { NextResponse } from "next/server";
import { getDbCompetitionIds } from "@/lib/queries";

const WCA_LIVE_API = "https://live.worldcubeassociation.org/api";

function isoDateMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

async function gql(query: string) {
  const res = await fetch(WCA_LIVE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    cache: "no-store",
  });
  return res.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(Number(searchParams.get("days") ?? "30"), 90);
  const compId = searchParams.get("comp"); // optional: test a specific WCA Live internal ID
  const from = isoDateMinus(days);

  const out: Record<string, unknown> = { days, from };

  // 1. Load DB competition IDs
  try {
    const dbIds = await getDbCompetitionIds();
    out.db_competition_count = dbIds.size;
    out.db_id_sample = Array.from(dbIds).slice(0, 5);
  } catch (e) {
    out.db_error = String(e);
  }

  // 2. Fetch competitions from WCA Live (include wca_id)
  const compQuery = `{
    competitions(from: "${from}") {
      id
      wca_id
      name
      start_date
      end_date
    }
  }`;
  const compJson = await gql(compQuery);
  out.competitions_raw = compJson;

  const competitions: { id: string; wca_id: string; name: string; start_date: string; end_date: string | null }[] =
    compJson?.data?.competitions ?? [];
  out.competition_count = competitions.length;
  out.competitions = competitions;

  // 3. Fetch detail + results for a specific competition (by internal WCA Live ID)
  const targetId = compId ?? competitions[0]?.id;
  if (targetId) {
    out.fetching_detail_for = targetId;

    const detailQuery = `{
      competition(id: "${targetId}") {
        id
        wca_id
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
    }`;

    const detailJson = await gql(detailQuery);
    out.detail_errors = detailJson?.errors ?? null;

    const comp = detailJson?.data?.competition;
    if (comp) {
      const swissResults: unknown[] = [];
      for (const ce of comp.competition_events ?? []) {
        for (const round of ce.rounds ?? []) {
          for (const r of round.results ?? []) {
            if (r.person?.country?.iso2 === "CH") {
              swissResults.push({
                event: ce.event?.id,
                person_name: r.person.name,
                person_wca_id: r.person.wca_id,
                best: r.best,
                average: r.average,
              });
            }
          }
        }
      }
      out.swiss_results_found = swissResults.length;
      out.swiss_results = swissResults;

      // Also check total result count for the first event/round
      const firstEvent = comp.competition_events?.[0];
      const firstRound = firstEvent?.rounds?.[0];
      out.first_event_id = firstEvent?.event?.id;
      out.first_round_result_count = firstRound?.results?.length ?? 0;
      out.first_round_sample = (firstRound?.results ?? []).slice(0, 2);
    }
  }

  return NextResponse.json(out, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
