export const EVENT_NAMES: Record<string, string> = {
  "333": "3x3x3",
  "222": "2x2x2",
  "444": "4x4x4",
  "555": "5x5x5",
  "666": "6x6x6",
  "777": "7x7x7",
  "333bf": "3x3x3 Blindfolded",
  "333fm": "3x3x3 Fewest Moves",
  "333oh": "3x3x3 One-Handed",
  clock: "Clock",
  minx: "Megaminx",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  "444bf": "4x4x4 Blindfolded",
  "555bf": "5x5x5 Blindfolded",
  "333mbf": "3x3x3 Multi-Blind",
};

export const EVENT_ORDER = [
  "333", "222", "444", "555", "666", "777",
  "333bf", "333fm", "333oh", "clock", "minx",
  "pyram", "skewb", "sq1", "444bf", "555bf", "333mbf",
];

export function eventName(id: string): string {
  return EVENT_NAMES[id] ?? id;
}

export function eventIconUrl(id: string): string {
  return `https://cdn.jsdelivr.net/gh/cubing/icons@main/src/svg/event/${id}.svg`;
}

export function sortedByEvent<T extends { event_id: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      (EVENT_ORDER.indexOf(a.event_id) ?? 99) -
      (EVENT_ORDER.indexOf(b.event_id) ?? 99)
  );
}
