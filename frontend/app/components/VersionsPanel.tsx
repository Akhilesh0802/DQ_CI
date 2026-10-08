"use client";

import { useEffect, useState } from "react";
import { Dataset, DatasetVersion } from "../lib/types";
import { downloadLog, downloadReport, fetchDatasetVersions } from "../lib/api";
import { formatServerDateTime } from "../lib/format";

type Props = {
  dataset: Dataset;
  activeVersionId: number | null;
  onSelect: (versionId: number) => void;
};

export default function VersionsPanel({ dataset, activeVersionId, onSelect }: Props) {
  const [versions, setVersions] = useState<DatasetVersion[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDatasetVersions(dataset.id)
      .then((list) => setVersions([...list].sort((a, b) => b.version_number - a.version_number)))
      .catch((err: Error) => setError(err.message));
  }, [dataset.id]);

  async function run(action: () => Promise<void>) {
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download fail ho gaya.");
    }
  }

  if (error && !versions) return <p className="text-red-600 text-sm">{error}</p>;
  if (!versions) return <p className="text-gray-400 text-sm">Loading versions...</p>;

  return (
    <div className="overflow-y-auto flex-1">
      {error && <p className="text-red-600 text-xs mb-2">{error}</p>}
      <div className="space-y-2">
        {versions.map((v) => (
          <div
            key={v.id}
            className={`border rounded-lg px-3 py-2 ${v.id === activeVersionId ? "border-[#4f2d7f] bg-[#faf8fd]" : "border-[#e5e2dc]"}`}
          >
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-900">
                v{v.version_number}
                {v.id === activeVersionId && <span className="ml-2 text-xs text-[#4f2d7f]">(dikh raha hai)</span>}
              </span>
              <span className="text-xs text-gray-500">{v.status} · {v.record_count?.toLocaleString() ?? "—"} rows</span>
            </div>
            <p className="text-xs text-gray-400 mb-1">{formatServerDateTime(v.uploaded_at)}</p>
            <div className="flex gap-4 text-sm font-semibold text-[#4f2d7f]">
              {v.status === "done" && v.id !== activeVersionId && (
                <button onClick={() => onSelect(v.id)} className="hover:underline">View</button>
              )}
              <button onClick={() => run(() => downloadLog(v.id, `${dataset.file_name}-v${v.version_number}`))} className="hover:underline">
                Log
              </button>
              {v.status === "done" && (
                <button onClick={() => run(() => downloadReport(v.id, `${dataset.file_name}-v${v.version_number}`))} className="hover:underline">
                  Excel report
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
