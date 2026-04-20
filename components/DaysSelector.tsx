"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  current: number;
  options: number[];
}

export default function DaysSelector({ current, options }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  function select(days: number) {
    const next = new URLSearchParams(params.toString());
    next.set("days", String(days));
    router.push(`?${next.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 shrink-0">Letzte</span>
      <div className="flex gap-1">
        {options.map((d) => (
          <button
            key={d}
            onClick={() => select(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              d === current
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {d}d
          </button>
        ))}
      </div>
    </div>
  );
}
