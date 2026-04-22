"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { PersonPRs } from "@/lib/queries";
import PRList from "./PRList";
import DaysSelector from "./DaysSelector";

interface FollowedPerson {
  wcaId: string;
  name: string;
}

interface SearchResult {
  wcaId: string;
  name: string;
  countryIso2: string;
}

const FOLLOWING_KEY = "wca-following";
const VALID_DAYS = [3, 7, 14, 30];
const DEFAULT_DAYS = 7;

export default function FollowingFeed() {
  const searchParams = useSearchParams();
  const days = VALID_DAYS.includes(Number(searchParams.get("days")))
    ? Number(searchParams.get("days"))
    : DEFAULT_DAYS;

  const [following, setFollowing] = useState<FollowedPerson[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [persons, setPersons] = useState<PersonPRs[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // Read localStorage once after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(FOLLOWING_KEY) ?? "[]");
      if (Array.isArray(stored)) setFollowing(stored);
    } catch {}
    setHydrated(true);
  }, []);

  // Stable key of WCA IDs — changes only when the set of followed people changes,
  // not when their stored display names are updated after a fetch.
  const idsKey = useMemo(
    () =>
      following
        .map((f) => f.wcaId)
        .sort()
        .join(","),
    [following]
  );

  // Fetch PRs whenever the followed IDs or the days window change
  useEffect(() => {
    if (!hydrated) return;
    if (following.length === 0) {
      setPersons(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setFetchError(false);

    const controller = new AbortController();
    fetch(
      `/api/feed?ids=${encodeURIComponent(idsKey)}&days=${days}`,
      { signal: controller.signal }
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<PersonPRs[]>;
      })
      .then((data) => {
        // Back-fill display names from returned data so future renders show
        // the canonical WCA name instead of whatever the user typed.
        const nameMap = new Map(data.map((p) => [p.personId, p.personName]));
        setFollowing((prev) => {
          let changed = false;
          const updated = prev.map((f) => {
            const fetched = nameMap.get(f.wcaId);
            if (fetched && fetched !== f.name) {
              changed = true;
              return { ...f, name: fetched };
            }
            return f;
          });
          if (!changed) return prev;
          try { localStorage.setItem(FOLLOWING_KEY, JSON.stringify(updated)); } catch {}
          return updated;
        });
        setPersons(data);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setFetchError(true);
        setLoading(false);
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, days, hydrated]);

  const addPerson = useCallback((person: FollowedPerson) => {
    setFollowing((prev) => {
      if (prev.some((p) => p.wcaId === person.wcaId)) return prev;
      const next = [...prev, person];
      try { localStorage.setItem(FOLLOWING_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const removePerson = useCallback((wcaId: string) => {
    setFollowing((prev) => {
      const next = prev.filter((p) => p.wcaId !== wcaId);
      try { localStorage.setItem(FOLLOWING_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // Prevent any render until localStorage has been read to avoid layout flicker
  if (!hydrated) return null;

  const totalPRs = persons?.reduce((s, p) => s + p.prs.length, 0) ?? 0;
  const cubersWithPRs = persons?.filter((p) => p.prs.length > 0).length ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🏆</span>
          <h1 className="text-3xl font-bold tracking-tight">WCA PR Collector</h1>
        </div>
        <p className="text-gray-500 text-sm">
          Persönliche Rekorde deiner gefolgten Cuber aus offiziellen WCA-Competitions
        </p>
      </header>

      <FollowingManager
        following={following}
        onAdd={addPerson}
        onRemove={removePerson}
      />

      {following.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6 mt-6">
          <DaysSelector current={days} options={VALID_DAYS} />
          {!loading && persons !== null && (
            <p className="text-sm text-gray-500">
              <span className="font-semibold text-gray-800">{totalPRs}</span> PRs von{" "}
              <span className="font-semibold text-gray-800">{cubersWithPRs}</span> Cubern
              in den letzten{" "}
              <span className="font-semibold text-gray-800">{days}</span> Tagen
            </p>
          )}
        </div>
      )}

      {following.length === 0 && <EmptyFollowingState />}
      {following.length > 0 && loading && <LoadingState />}
      {following.length > 0 && !loading && fetchError && <FetchErrorState />}
      {following.length > 0 && !loading && !fetchError && persons !== null && persons.length === 0 && (
        <NoPRsState days={days} />
      )}
      {following.length > 0 && !loading && !fetchError && persons && persons.length > 0 && (
        <PRList persons={persons} />
      )}
    </div>
  );
}

// ─── FollowingManager ─────────────────────────────────────────────────────────

function FollowingManager({
  following,
  onAdd,
  onRemove,
}: {
  following: FollowedPerson[];
  onAdd: (person: FollowedPerson) => void;
  onRemove: (wcaId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDone, setSearchDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced name/ID search against local DB
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setSearchDone(false);
      return;
    }

    setIsSearching(true);
    setSearchDone(false);
    const timer = setTimeout(() => {
      fetch(`/api/persons/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data: SearchResult[]) => {
          setSuggestions(data);
          setIsOpen(true);
          setIsSearching(false);
          setSearchDone(true);
        })
        .catch(() => {
          setIsSearching(false);
          setSearchDone(true);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        !inputRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSelect(result: SearchResult) {
    onAdd({ wcaId: result.wcaId, name: result.name });
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const trimmed = query.trim().toUpperCase();
      // If it looks like a WCA ID, add directly without needing a DB match
      if (/^[0-9]{4}[A-Z]{4}[0-9]{2}$/.test(trimmed)) {
        onAdd({ wcaId: trimmed, name: trimmed });
        setQuery("");
        setIsOpen(false);
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  const showNoResults = isOpen && searchDone && !isSearching && suggestions.length === 0;

  return (
    <div>
      {/* Chips for followed cubers */}
      {following.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {following.map((f) => (
            <span
              key={f.wcaId}
              className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-sm text-blue-800"
            >
              {f.name}
              <button
                type="button"
                onClick={() => onRemove(f.wcaId)}
                aria-label={`${f.name} entfernen`}
                className="text-blue-400 hover:text-blue-700 transition-colors text-base leading-none -mr-0.5"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input + dropdown */}
      <div className="relative inline-block w-full sm:w-80">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setIsOpen(true); }}
            placeholder="Cuber hinzufügen (Name oder WCA-ID)…"
            className="w-full px-4 py-2 pr-9 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-transparent placeholder:text-gray-400"
          />
          {isSearching ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : query ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => { setQuery(""); setIsOpen(false); inputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ×
            </button>
          ) : null}
        </div>

        {(isOpen || showNoResults) && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden"
          >
            {suggestions.map((r) => {
              const already = following.some((f) => f.wcaId === r.wcaId);
              return (
                <button
                  key={r.wcaId}
                  type="button"
                  disabled={already}
                  onClick={() => handleSelect(r)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors ${
                    already
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-blue-50 cursor-pointer"
                  }`}
                >
                  <span className="flex flex-col min-w-0">
                    <span className="font-medium text-gray-900 truncate">{r.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{r.wcaId}</span>
                  </span>
                  <span className="text-xs text-gray-400 shrink-0 ml-3">{r.countryIso2}</span>
                </button>
              );
            })}
            {showNoResults && (
              <p className="px-4 py-3 text-sm text-gray-500">
                Keine Treffer. WCA-ID direkt eingeben (z.B.{" "}
                <span className="font-mono">2015MUEL01</span>) und Enter drücken.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── States ───────────────────────────────────────────────────────────────────

function EmptyFollowingState() {
  return (
    <div className="mt-12 flex flex-col items-center text-center gap-3">
      <div className="text-5xl">🔍</div>
      <h2 className="text-xl font-semibold text-gray-800">
        Starte deinen persönlichen Feed
      </h2>
      <p className="text-gray-500 text-sm max-w-sm">
        Suche oben nach einem Cuber oder gib eine WCA-ID ein, um dessen PRs zu verfolgen.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
        >
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

function FetchErrorState() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p className="text-red-700 font-medium">Fehler beim Laden der PRs</p>
      <p className="text-red-500 text-sm mt-1">
        Bitte Seite neu laden oder später erneut versuchen.
      </p>
    </div>
  );
}

function NoPRsState({ days }: { days: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
      <p className="text-gray-500">
        Keine PRs der gefolgten Cuber in den letzten {days} Tagen gefunden.
      </p>
      <p className="text-gray-400 text-sm mt-1">
        Versuche einen längeren Zeitraum.
      </p>
    </div>
  );
}
