"use client";

import { useState } from "react";
import { ColumnProfile } from "../lib/types";

const TYPE_COLORS: Record<string, string> = {
  NUMERIC: "#4f2d7f",
  DATE: "#0f6e56",
  TEXT: "#5f5e5a",
  BOOLEAN: "#993556",
};

function formatValue(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  return value;
}

type Props = {
  columns: ColumnProfile[];
};

export default function ColumnMetricsPanel({ columns }: Props) {
  const [openColumn, setOpenColumn] = useState<string | null>(columns[0]?.column_name ?? null);

  if (columns.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Is dataset ke liye column metrics available nahi hain (ye purani upload hai) — dobara upload karo.
      </p>
    );
  }

  return (
    <div className="overflow-y-auto flex-1 space-y-2 pr-1">
      {columns.map((col) => {
        const isOpen = openColumn === col.column_name;
        return (
          <div key={col.column_name} className="border border-[#e5e2dc] rounded-lg overflow-hidden">
            <button
              onClick={() => setOpenColumn(isOpen ? null : col.column_name)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[#f7f6f3] text-left"
            >
              <span className="text-sm font-semibold text-gray-900">{col.column_name}</span>
              <span className="flex items-center gap-2">
                {col.detected_format && <span className="text-xs text-gray-500">{col.detected_format}</span>}
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: TYPE_COLORS[col.inferred_type] }}
                >
                  {col.inferred_type}
                </span>
              </span>
            </button>
            {isOpen && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-3 py-3">
                {col.metrics.map((m) => (
                  <div key={m.key} className="flex justify-between text-xs">
                    <span className="text-gray-500">{m.label}</span>
                    <span className="text-gray-900 font-medium text-right">{formatValue(m.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
