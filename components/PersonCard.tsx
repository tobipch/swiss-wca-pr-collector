import type { PersonPRs, PR } from "@/lib/queries";
import { eventName, eventIconUrl, EVENT_ORDER } from "@/lib/events";
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
    <div id={person.personId} className="bg-white rounded-xl border border-gray-200 p-5 scroll-mt-4">
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
            {single && <PRBadge pr={single} />}
            {average && <PRBadge pr={average} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function PRBadge({ pr }: { pr: PR }) {
  const compUrl = `https://live.worldcubeassociation.org/competitions/${pr.competitionId}`;

  const isSingle = pr.type === "single";
  const colors = isSingle
    ? "bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-300"
    : "bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-300";

  return (
    <a
      href={compUrl}
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
        <span className="text-xs font-medium text-gray-500">
          {eventName(pr.eventId)}
        </span>
        <span className={`text-xs ml-auto font-medium ${isSingle ? "text-blue-500" : "text-orange-500"}`}>
          {isSingle ? "Single" : "Avg"}
        </span>
      </div>

      {/* Time */}
      <span className="text-lg font-bold font-mono text-gray-900">
        {formatTime(pr.time, pr.eventId)}
      </span>

      {/* Rankings */}
      <div className="flex gap-1 flex-wrap">
        {pr.regionalRecord && (
          <RecordBadge label={pr.regionalRecord} highlight />
        )}
        {pr.wr && <RecordBadge label={`WR ${pr.wr}`} />}
        {pr.cr && <RecordBadge label={`CR ${pr.cr}`} />}
        {pr.nr && <RecordBadge label={`NR ${pr.nr}`} />}
      </div>

      {/* Competition */}
      <span className="text-xs text-gray-400 group-hover:text-gray-600 truncate transition-colors">
        {pr.competitionName}
      </span>
    </a>
  );
}

function RecordBadge({ label, highlight }: { label: string; highlight?: boolean }) {
  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
        highlight
          ? "bg-amber-100 text-amber-700"
          : "bg-white/80 text-gray-600 border border-gray-200"
      }`}
    >
      {label}
    </span>
  );
}
