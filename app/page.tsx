import { Suspense } from "react";
import { fetchPRs, getImportDate, getAllSwissRanks, getDbCompetitionIds } from "@/lib/queries";
import { fetchLivePRs } from "@/lib/wca-live";
import type { PersonPRs } from "@/lib/queries";
import PRList from "@/components/PRList";
import DaysSelector from "@/components/DaysSelector";

const VALID_DAYS = [7, 14, 30];
const DEFAULT_DAYS = 30;

interface Props {
  searchParams: Promise<{ days?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const params = await searchParams;
  const days = VALID_DAYS.includes(Number(params.days))
    ? Number(params.days)
    : DEFAULT_DAYS;

  const [dbPersons, importDate, ranks, dbCompIds] = await Promise.all([
    fetchPRs(days).catch(() => null),
    getImportDate(),
    getAllSwissRanks().catch(() => ({ single: new Map(), average: new Map() })),
    getDbCompetitionIds().catch(() => new Set<string>()),
  ]);

  // Merge live PRs (competitions not yet in WCA DB) into the result set
  const livePRs = await fetchLivePRs(days, dbCompIds, ranks).catch(() => []);

  const persons = mergeLive(dbPersons, livePRs);

  const totalPRs = persons?.reduce((sum, p) => sum + p.prs.length, 0) ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🇨🇭</span>
          <h1 className="text-3xl font-bold tracking-tight">WCA PR Collector</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Persönliche Rekorde Schweizer Speedcuber aus offiziellen WCA-Competitions
        </p>
        {importDate && (
          <p className="text-gray-400 text-xs mt-1">
            Datenbankstand: {new Date(importDate).toLocaleDateString("de-CH")}
          </p>
        )}
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <DaysSelector current={days} options={VALID_DAYS} />
        {persons && (
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-800">{totalPRs}</span> PRs von{" "}
            <span className="font-semibold text-gray-800">{persons.length}</span> Cubern
            in den letzten <span className="font-semibold text-gray-800">{days}</span> Tagen
          </p>
        )}
      </div>

      <Suspense fallback={<LoadingState />}>
        {persons === null ? (
          <ErrorState />
        ) : persons.length === 0 ? (
          <EmptyState days={days} />
        ) : (
          <PRList persons={persons} />
        )}
      </Suspense>
    </div>
  );
}

function mergeLive(
  db: PersonPRs[] | null,
  live: PersonPRs[]
): PersonPRs[] | null {
  if (db === null) return null;
  if (live.length === 0) return db;

  const result = db.map((p) => ({ ...p, prs: [...p.prs] }));
  const byId = new Map(result.map((p) => [p.personId, p]));

  for (const lp of live) {
    const existing = byId.get(lp.personId);
    if (existing) {
      existing.prs.push(...lp.prs);
    } else {
      result.push({ ...lp });
    }
  }

  const minRank = (p: PersonPRs, key: "nr" | "cr" | "wr") =>
    Math.min(...p.prs.map((pr) => pr[key] ?? Infinity));
  result.sort(
    (a, b) =>
      minRank(a, "nr") - minRank(b, "nr") ||
      minRank(a, "cr") - minRank(b, "cr") ||
      minRank(a, "wr") - minRank(b, "wr")
  );

  return result;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
          <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-16 w-36 bg-gray-100 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p className="text-red-700 font-medium">Datenbankverbindung fehlgeschlagen</p>
      <p className="text-red-500 text-sm mt-1">
        Stelle sicher, dass die Umgebungsvariable DATABASE_URL gesetzt ist und die Datenbank
        importiert wurde.
      </p>
    </div>
  );
}

function EmptyState({ days }: { days: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
      <p className="text-gray-500">
        Keine PRs von Schweizer Cubern in den letzten {days} Tagen gefunden.
      </p>
    </div>
  );
}
