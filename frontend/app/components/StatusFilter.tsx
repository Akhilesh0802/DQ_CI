"use client";

import { Dataset } from "../lib/types";

export type StatusFilterValue = "all" | "running" | "done" | "failed";

export function matchesFilter(dataset: Dataset, filter: StatusFilterValue): boolean {
  if (filter === "all") return true;
  if (filter === "running") return dataset.status === "processing" || dataset.status === "uploaded";
  if (filter === "done") return dataset.status === "done";
  return dataset.status === "failed" || dataset.status === "cancelled";
}

type Props = {
  datasets: Dataset[];
  value: StatusFilterValue;
  onChange: (value: StatusFilterValue) => void;
};

const OPTIONS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "running", label: "Running" },
  { value: "done", label: "Done" },
  { value: "failed", label: "Failed" },
];

export default function StatusFilter({ datasets, value, onChange }: Props) {
  return (
    <div className="flex gap-2.5 mb-5 flex-wrap">
      {OPTIONS.map((opt) => {
        const count = datasets.filter((d) => matchesFilter(d, opt.value)).length;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`h-10 px-[18px] rounded-full text-sm font-semibold border-[1.5px] transition ${
              active ? "bg-[#4f2d7f] text-white border-[#4f2d7f] font-bold" : "bg-white text-[#1d1530] border-[#cbc4bc] hover:bg-[#f1eeea]"
            }`}
          >
            {opt.label} <span className={active ? "text-white/85" : "text-[#5b5370]"}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}
