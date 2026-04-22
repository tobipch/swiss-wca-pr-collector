import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

// Key format: "${person_id}:${event_id}:${type}:${time}"
// Stable across WCA Live → DB transitions because the time value is identical.

export async function GET() {
  try {
    const rows = await sql<{ person_id: string; event_id: string; type: string; time: number; count: number }[]>`
      SELECT person_id, event_id, type, time, count FROM bravos WHERE count > 0
    `;
    const result: Record<string, number> = {};
    for (const row of rows) {
      result[`${row.person_id}:${row.event_id}:${row.type}:${row.time}`] = row.count;
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(req: NextRequest) {
  try {
    const { personId, eventId, type, time, delta } = await req.json() as {
      personId: string;
      eventId: string;
      type: string;
      time: number;
      delta: number;
    };
    if (!personId || !eventId || !type || !time || (delta !== 1 && delta !== -1)) {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }
    const rows = await sql<{ count: number }[]>`
      INSERT INTO bravos (person_id, event_id, type, time, count)
      VALUES (${personId}, ${eventId}, ${type}, ${time}, GREATEST(0, ${delta}::int))
      ON CONFLICT (person_id, event_id, type, time) DO UPDATE
      SET count = GREATEST(0, bravos.count + ${delta}::int)
      RETURNING count
    `;
    return NextResponse.json({ count: rows[0].count });
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
