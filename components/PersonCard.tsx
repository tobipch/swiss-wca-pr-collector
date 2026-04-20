import type { PersonPRs, PR } from "@/lib/queries";
import { eventName, eventIconUrl, sortedByEvent } from "@/lib/events";
import { formatTime } from "@/lib/format";

interface Props {
  person: PersonPRs;
}

export default function PersonCard({ person }: Props) {
  const sorted = sortedByEvent(
    person.prs.map((pr) => ({ ...pr, event_id: pr.eventId }))
  ).map(({ event_id: _, ...pr }) => pr as PR);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
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

      <div className="flex flex-wrap gap-2">
        {sorted.map((pr, i) => (
          <PRBadge key={i} pr={pr} personId={person.personId} />
        ))}
      </div>
    </div>
  );
}

function PRBadge({ pr, personId }: { pr: PR; personId: string }) {
  const compUrl = `https://live.worldcubeassociation.org/competitions/${pr.competitionId}`;

  return (
    <a
      href={compUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-1 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg px-3 py-2 transition-colors min-w-[8rem]"
    >
      {/* Event header */}
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={eventIconUrl(pr.eventId)}
          alt={eventName(pr.eventId)}
          width={16}
          height={16}
          className="opacity-70"
        />
        <span className="text-xs font-medium text-gray-500">
          {eventName(pr.eventId)}
        </span>
        <span className="text-xs text-gray-400 ml-auto">
          {pr.type === "single" ? "Single" : "Avg"}
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
      <span className="text-xs text-gray-400 group-hover:text-blue-500 truncate transition-colors">
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
          : "bg-gray-100 text-gray-600"
      }`}
    >
      {label}
    </span>
  );
}
