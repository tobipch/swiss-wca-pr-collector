"use client";

import { useState } from "react";
import type { PersonPRs } from "@/lib/queries";
import { eventName, EVENT_ORDER } from "@/lib/events";
import PersonCard from "./PersonCard";
import JumpNav from "./JumpNav";

interface Props {
  persons: PersonPRs[];
}

export default function PRList({ persons }: Props) {
  const [selectedEvent, setSelectedEvent] = useState<string>("all");

  // Collect all event IDs that appear in any PR, sorted by EVENT_ORDER
  const eventIds = Array.from(
    new Set(persons.flatMap((p) => p.prs.map((pr) => pr.eventId)))
  ).sort((a, b) => {
    const ai = EVENT_ORDER.indexOf(a);
    const bi = EVENT_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const filtered =
    selectedEvent === "all"
      ? persons
      : persons.filter((p) =>
          p.prs.some((pr) => pr.eventId === selectedEvent)
        );

  return (
    <div>
      {eventIds.length > 1 && (
        <div className="flex items-center gap-2 mb-5">
          <label htmlFor="event-filter" className="text-sm text-gray-500 shrink-0">
            Event
          </label>
          <select
            id="event-filter"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">Alle Events</option>
            {eventIds.map((id) => (
              <option key={id} value={id}>
                {eventName(id)}
              </option>
            ))}
          </select>
          {selectedEvent !== "all" && (
            <span className="text-xs text-gray-400">
              {filtered.length} Cuber
            </span>
          )}
        </div>
      )}
      <JumpNav persons={filtered} />
      <div className="space-y-4">
        {filtered.map((person) => (
          <PersonCard key={person.personId} person={person} />
        ))}
      </div>
    </div>
  );
}
