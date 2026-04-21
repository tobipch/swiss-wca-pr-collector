"use client";

import { useState } from "react";
import type { PersonPRs, PR } from "@/lib/queries";
import { eventName, eventIconUrl, EVENT_ORDER, typeLabel } from "@/lib/events";
import { formatTime } from "@/lib/format";

interface Props {
  person: PersonPRs;
  initialOpen?: boolean;
  highlightEvent?: string;
}

export default function PersonCard({ person, initialOpen = true, highlightEvent }: Props) {
  const [open, setOpen] = useState(initialOpen);

  // Group PRs by event (multiple PRs per event are allowed, e.g. DB + live)
  const byEvent = new Map<string, PR[]>();
  for (const pr of person.prs) {
    if (!byEvent.has(pr.eventId)) byEvent.set(pr.eventId, []);
    byEvent.get(pr.eventId)!.push(pr);
  }

  const eventGroups = Array.from(byEvent.entries()).sort(([aId, aPrs], [bId, bPrs]) => {
    const minRank = (prs: PR[], key: "nr" | "cr" | "wr") =>
      Math.min(...prs.map((p) => p[key] ?? Infinity));
    const diff =
      minRank(aPrs, "nr") - minRank(bPrs, "nr") ||
      minRank(aPrs, "cr") - minRank(bPrs, "cr") ||
      minRank(aPrs, "wr") - minRank(bPrs, "wr");
    if (diff !== 0) return diff;
    return (
      (EVENT_ORDER.indexOf(aId) === -1 ? 99 : EVENT_ORDER.indexOf(aId)) -
      (EVENT_ORDER.indexOf(bId) === -1 ? 99 : EVENT_ORDER.indexOf(bId))
    );
  });

  const hasLive = person.prs.some((pr) => pr.isLive);

  return (
    <div
      id={person.personId}
      className="bg-white rounded-xl border border-gray-200 scroll-mt-4 overflow-hidden"
    >
      {/* Accordion header */}
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <a
            href={`https://www.worldcubeassociation.org/persons/${person.personId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-gray-900 hover:text-blue-600 transition-colors truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {person.personName}
          </a>
          <span className="text-xs text-gray-400 font-mono shrink-0">
            {person.personId}
          </span>
          {hasLive && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
              Live
            </span>
          )}
        </div>
        <ChevronIcon open={open} />
      </div>

      {/* Collapsible body */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="flex flex-col gap-2 pt-3">
            {eventGroups.map(([eventId, prs]) => {
              const dimmed = highlightEvent != null && eventId !== highlightEvent;
              return (
                <div
                  key={eventId}
                  className={`flex gap-2 flex-wrap transition-opacity duration-200 ${dimmed ? "opacity-30" : ""}`}
                >
                  {prs.map((pr: PR, i: number) => (
                    <PRBadge
                      key={`${pr.type}-${pr.competitionId}-${i}`}
                      pr={pr}
                      personId={person.personId}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ml-2 ${open ? "" : "-rotate-90"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function PRBadge({ pr, personId }: { pr: PR; personId: string }) {
  const href = `https://www.worldcubeassociation.org/persons/${personId}?event=${pr.eventId}`;
  const isSingle = pr.type === "single";

  const colors = pr.isLive
    ? "bg-red-50 hover:bg-red-100 border-red-200 hover:border-red-300"
    : isSingle
    ? "bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-300"
    : "bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-300";

  const typeColor = pr.isLive
    ? "text-red-500"
    : isSingle
    ? "text-blue-500"
    : "text-orange-500";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col gap-1 border rounded-lg px-3 py-2 transition-colors min-w-[9rem] flex-1 max-w-[14rem] ${colors}`}
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

      {/* Rankings / badges */}
      <div className="flex gap-1 flex-wrap">
        {pr.isLive && (
          <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
            LIVE
          </span>
        )}
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
