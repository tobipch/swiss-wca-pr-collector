"use client";

import { useState } from "react";
import type { PersonPRs, PR } from "@/lib/queries";
import { eventName, eventIconUrl, EVENT_ORDER, typeLabel } from "@/lib/events";
import { formatTime } from "@/lib/format";

interface Props {
  person: PersonPRs;
  initialOpen?: boolean;
  highlightEvent?: string;
  bravoCount?: number;
  isLiked?: boolean;
  onBravo?: () => void;
}

interface DedupedPR {
  pr: PR;
  prevTime?: number;
}

export default function PersonCard({
  person,
  initialOpen = true,
  highlightEvent,
  bravoCount = 0,
  isLiked = false,
  onBravo,
}: Props) {
  const [open, setOpen] = useState(initialOpen);

  // Deduplicate: for each (eventId, type) keep the most recent PR; if same
  // date, keep the better (lower) time. The displaced entry becomes prevTime.
  const byEventType = new Map<string, PR[]>();
  for (const pr of person.prs) {
    const key = `${pr.eventId}:${pr.type}`;
    if (!byEventType.has(key)) byEventType.set(key, []);
    byEventType.get(key)!.push(pr);
  }

  const dedupedPRs: DedupedPR[] = [];
  for (const prs of Array.from(byEventType.values())) {
    const sorted = [...prs].sort((a, b) => {
      const dateDiff = b.endDate.localeCompare(a.endDate);
      if (dateDiff !== 0) return dateDiff;
      return a.time - b.time;
    });
    const current = sorted[0];
    const prevTime = sorted.length > 1 ? sorted[1].time : current.prevTime;
    dedupedPRs.push({ pr: current, prevTime });
  }

  // Re-group by eventId for row display
  const byEvent = new Map<string, DedupedPR[]>();
  for (const item of dedupedPRs) {
    if (!byEvent.has(item.pr.eventId)) byEvent.set(item.pr.eventId, []);
    byEvent.get(item.pr.eventId)!.push(item);
  }

  const eventGroups = Array.from(byEvent.entries()).sort(([aId, aItems], [bId, bItems]) => {
    const minRank = (items: DedupedPR[], key: "nr" | "cr" | "wr") =>
      Math.min(...items.map((i) => i.pr[key] ?? Infinity));
    const diff =
      minRank(aItems, "nr") - minRank(bItems, "nr") ||
      minRank(aItems, "cr") - minRank(bItems, "cr") ||
      minRank(aItems, "wr") - minRank(bItems, "wr");
    if (diff !== 0) return diff;
    return (
      (EVENT_ORDER.indexOf(aId) === -1 ? 99 : EVENT_ORDER.indexOf(aId)) -
      (EVENT_ORDER.indexOf(bId) === -1 ? 99 : EVENT_ORDER.indexOf(bId))
    );
  });

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
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <BravoButton count={bravoCount} liked={isLiked} onBravo={onBravo} />
          <ChevronIcon open={open} />
        </div>
      </div>

      {/* Collapsible body */}
      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          <div className="flex flex-col gap-2 pt-3">
            {eventGroups.map(([eventId, items]) => {
              const dimmed = highlightEvent != null && eventId !== highlightEvent;
              return (
                <div
                  key={eventId}
                  className={`flex gap-2 flex-wrap transition-opacity duration-200 ${dimmed ? "opacity-30" : ""}`}
                >
                  {items.map((item, i) => (
                    <PRBadge
                      key={`${item.pr.type}-${item.pr.competitionId}-${i}`}
                      pr={item.pr}
                      personId={person.personId}
                      prevTime={item.prevTime}
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

function BravoButton({
  count,
  liked,
  onBravo,
}: {
  count: number;
  liked: boolean;
  onBravo?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onBravo?.();
      }}
      className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors ${
        liked
          ? "text-red-500 bg-red-50 hover:bg-red-100"
          : "text-gray-400 hover:text-red-400 hover:bg-red-50"
      }`}
      aria-label={liked ? "Bravo entfernen" : "Bravo geben"}
    >
      <HeartIcon filled={liked} />
      {count > 0 && (
        <span>{count}&nbsp;{count === 1 ? "Bravo" : "Bravos"}</span>
      )}
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="w-4 h-4 shrink-0"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-400 transition-transform shrink-0 ${open ? "" : "-rotate-90"}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function PRBadge({ pr, personId, prevTime }: { pr: PR; personId: string; prevTime?: number }) {
  const href = pr.liveUrl
    ? pr.liveUrl
    : `https://www.worldcubeassociation.org/persons/${personId}?event=${pr.eventId}`;
  const isSingle = pr.type === "single";

  const colors = isSingle
    ? "bg-blue-50 hover:bg-blue-100 border-blue-200 hover:border-blue-300"
    : "bg-orange-50 hover:bg-orange-100 border-orange-200 hover:border-orange-300";

  const typeColor = isSingle ? "text-blue-500" : "text-orange-500";

  const record = pr.regionalRecord && pr.regionalRecord !== "PR" ? pr.regionalRecord : null;
  const glow = record ? "shadow-[0_0_12px_4px_rgba(34,197,94,0.5)]" : "";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex flex-col gap-1 border rounded-lg px-3 py-2 transition-colors min-w-[9rem] flex-1 max-w-[14rem] ${colors} ${glow}`}
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

      {/* Previous PR — directly below the time */}
      {prevTime != null && prevTime > 0 && (
        <span className="text-xs text-gray-400 -mt-0.5">
          vorher <span className="font-mono">{formatTime(prevTime, pr.eventId, pr.type)}</span>
        </span>
      )}

      {/* Rankings / record badges — "PR" tag is suppressed (redundant) */}
      <div className="flex gap-1 flex-wrap">
        {pr.regionalRecord && pr.regionalRecord !== "PR" && (
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
