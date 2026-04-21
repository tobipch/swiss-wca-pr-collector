/**
 * Temporary debug endpoint — remove once WCA Live integration is confirmed working.
 * Visit /api/debug-live?days=30 (or ?days=90 etc.)
 * Optional: &comp=<WCA Live internal numeric id> to inspect a specific competition.
 */

import { NextResponse } from "next/server";
import { getDbCompetitionIds } from "@/lib/queries";

const WCA_LIVE_API = "https://live.worldcubeassociation.org/api";

function isoDateMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await fetch(WCA_LIVE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
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
  const compQuery = `
    query($from: Date) {
      competitions(from: $from) {
        id
        wca_id
        name
        start_date
        end_date
      }
    }
  `;
  const compJson = await gql(compQuery, { from });
  out.competitions_errors = compJson?.errors ?? null;

  const competitions: {
    id: string;
    wca_id: string;
    name: string;
    start_date: string;
    end_date: string | null;
  }[] = compJson?.data?.competitions ?? [];
  out.competition_count = competitions.length;
  out.competitions = competitions;

  // 3. For a specific competition, fetch competitors (step 1 of new 2-step flow)
  const targetId = compId ?? competitions[0]?.id;
  if (targetId) {
    out.fetching_competitors_for = targetId;

    const competitorsQuery = `
      query($id: ID!) {
        competition(id: $id) {
          id
          wca_id
          name
          start_date
          end_date
          competitors {
            id
            wca_id
            name
            country { iso2 }
          }
        }
      }
    `;
    const competitorsJson = await gql(competitorsQuery, { id: targetId });
    out.competitors_errors = competitorsJson?.errors ?? null;

    const comp = competitorsJson?.data?.competition;
    if (comp) {
      out.competition_detail = {
        id: comp.id,
        wca_id: comp.wca_id,
        name: comp.name,
        total_competitors: comp.competitors?.length ?? 0,
      };

      const swissCompetitors = (comp.competitors ?? []).filter(
        (c: { country: { iso2: string } | null }) => c.country?.iso2 === "CH"
      );
      out.swiss_competitor_count = swissCompetitors.length;
      out.swiss_competitors = swissCompetitors.slice(0, 20);

      // 4. Step 2: Batch-query results for the first few Swiss competitors
      const sample = swissCompetitors.slice(0, 5);
      if (sample.length > 0) {
        const aliases = sample
          .map(
            (c: { id: string }, i: number) => `
          p${i}: person(id: "${c.id}") {
            id
            wca_id
            name
            results {
              best
              average
              single_record_tag
              average_record_tag
              round {
                id
                competition_event {
                  event { id }
                }
              }
            }
          }`
          )
          .join("\n");
        const batchQuery = `query PersonBatch {${aliases}\n}`;
        const batchJson = await gql(batchQuery);
        out.person_batch_errors = batchJson?.errors ?? null;
        out.person_batch = batchJson?.data ?? null;
      }
    }
  }

  return NextResponse.json(out, {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
