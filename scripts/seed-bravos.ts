import "dotenv/config";
import { sql } from "../lib/db";

async function main() {
  const rows = await sql<{ result: { personId: string; personName: string; prs: { eventId: string; type: string; time: number }[] }[] }[]>`
    SELECT result FROM pr_cache LIMIT 1
  `;
  const persons = rows[0]?.result ?? [];

  if (persons.length === 0) {
    console.log("pr_cache ist leer — bitte zuerst Daten importieren.");
    return;
  }

  // Collect enough PRs for all three levels + a few defaults
  const seeds: { personId: string; eventId: string; type: string; time: number; count: number }[] = [];
  let idx = 0;
  for (const p of persons) {
    for (const pr of p.prs) {
      const count = [5, 7, 12, 25, 3][idx % 5]; // L1, L1, L2, L3, default
      seeds.push({ personId: p.personId, eventId: pr.eventId, type: pr.type, time: pr.time, count });
      idx++;
      if (idx >= 20) break;
    }
    if (idx >= 20) break;
  }

  for (const s of seeds) {
    await sql`
      INSERT INTO bravos (person_id, event_id, type, time, count)
      VALUES (${s.personId}, ${s.eventId}, ${s.type}, ${s.time}, ${s.count})
      ON CONFLICT (person_id, event_id, type, time) DO UPDATE SET count = ${s.count}
    `;
    console.log(`${s.count.toString().padStart(2)} Bravos → ${s.personId} ${s.eventId} ${s.type}`);
  }

  console.log(`\n${seeds.length} Einträge gesetzt.`);
}

main().catch(console.error).finally(() => sql.end());
