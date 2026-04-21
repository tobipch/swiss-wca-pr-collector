import type { PersonPRs, PR } from "@/lib/queries";
import { eventName, eventIconUrl, EVENT_ORDER, typeLabel } from "@/lib/events";
import { formatTime } from "@/lib/format";

interface Props {
  person: PersonPRs;
}

export default function PersonCard({ person }: Props) {
  // Group PRs by event, preserving EVENT_ORDER
  const byEvent = new Map<string, { single?: PR; average?: PR }>();
  for (const pr of person.prs) {
    if (!byEvent.has(pr.eventId)) byEvent.set(pr.eventId, {});
    const entry = byEvent.get(pr.eventId)!;
    if (pr.type === "single") entry.single = pr;
    else entry.average = pr;
  }

  const eventGroups = [...byEvent.entries()].sort(
    ([a], [b]) =>
      (EVENT_ORDER.indexOf(a) === -1 ? 99 : EVENT_ORDER.indexOf(a)) -
      (EVENT_ORDER.indexOf(b) === -1 ? 99 : EVENT_ORDER.indexOf(b))
  );

  return (
    <div
      id={person.personId}
      className="bg-white rounded-xl border border-gray-200 p-5 scroll-mt-4"
    >
      <div className="flex items-center justify-between mb-4">
        <a
          href={`https://www.worldcubeassociation.org/persons/${person.personId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-gray-900 hover:text-blue-600 transition-colors"
        >
          {person.personName}
        </a>
        <span className="text-xs text-gray-400 font-mono">{person.personId}</span>
      </div>

      <div className="flex flex-col gap-2">
        {eventGroups.map(([eventId, { single, average }]) => (
          <div key={eventId} className="flex gap-2">
            {single && <PRBadge pr={single} personId={person.personId} />}
            {average && <PRBadge pr={average} personId={person.personId} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PRBadge({ pr, personId }: { pr: PR; personId: string }) {
  const href = `https://www.worldcubeassociation.org/persons/${personId}?event=${pr.eventId}`;
  const isSingle = pr.type === "single";

  const colors = isSingle
    ? "bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-300"
    : "bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-300";

  const typeColor = isSingle ? "text-blue-500" : "text-orange-500";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col gap-1 border rounded-lg px-3 py-2 transition-colors min-w-[8rem] flex-1 max-w-[12rem] ${colors}`}
    >
      {/* Event header */}
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={eventIconUrl(pr.eventId)}
          alt={eventName(pr.eventId)}
          width={16}
          height={16}
          className="opacity-60"
        />
        <span className="text-xs font-medium text-gray-500 truncate">
          {eventName(pr.eventId)}
        </span>
        <span className={`text-xs ml-auto font-medium shrink-0 ${typeColor}`}>
          {typeLabel(pr.eventId, pr.type)}
        </span>
      </div>

      {/* Time */}
      <span className="text-lg font-bold font-mono text-gray-900">
        {formatTime(pr.time, pr.eventId, pr.type)}
      </span>

      {/* Rankings */}
      <div className="flex gap-1 flex-wrap">
        {pr.regionalRecord && (
          <RecordHighlight record={pr.regionalRecord} />
        )}
        {pr.wr && <RankBadge label="WR" value={pr.wr} />}
        {pr.cr && <RankBadge label="CR" value={pr.cr} />}
        {pr.nr && <RankBadge label="NR" value={pr.nr} />}
      </div>

      {/* Competition */}
      <span className="text-xs text-gray-400 group-hover:text-gray-600 truncate transition-colors">
        {pr.competitionName}
      </span>
    </a>
  );
}

function RecordHighlight({ record }: { record: string }) {
  const styles: Record<string, string> = {
    WR: "bg-yellow-400 text-yellow-900 ring-1 ring-yellow-500",
    CR: "bg-blue-500 text-white ring-1 ring-blue-600",
    NR: "bg-green-500 text-white ring-1 ring-green-600",
  };
  const style =
    styles[record] ?? "bg-amber-100 text-amber-800 ring-1 ring-amber-300";

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${style}`}>
      {record}
    </span>
  );
}

function RankBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded font-medium bg-white/80 text-gray-600 border border-gray-200">
      {label} {value}
    </span>
  );
}
