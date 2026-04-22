import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";

export async function GET() {
  try {
    const rows = await sql<{ person_id: string; count: number }[]>`
      SELECT person_id, count FROM bravos WHERE count > 0
    `;
    const result: Record<string, number> = {};
    for (const row of rows) result[row.person_id] = row.count;
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({});
  }
}

export async function POST(req: NextRequest) {
  try {
    const { personId, delta } = await req.json();
    if (!personId || (delta !== 1 && delta !== -1)) {
      return NextResponse.json({ error: "Invalid" }, { status: 400 });
    }
    const rows = await sql<{ count: number }[]>`
      INSERT INTO bravos (person_id, count)
      VALUES (${personId}, GREATEST(0, ${delta}::int))
      ON CONFLICT (person_id) DO UPDATE
      SET count = GREATEST(0, bravos.count + ${delta}::int)
      RETURNING count
    `;
    return NextResponse.json({ count: rows[0].count });
  } catch {
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
}
