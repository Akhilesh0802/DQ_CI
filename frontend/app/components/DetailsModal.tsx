"use client";

import { useEffect, useState } from "react";
import { Dataset, Profile } from "../lib/types";
import { downloadReport, fetchProfile } from "../lib/api";
import ChatPanel from "./ChatPanel";
import ColumnMetricsPanel from "./ColumnMetricsPanel";
import VersionsPanel from "./VersionsPanel";

type Props = {
  dataset: Dataset;
  onClose: () => void;
};

type Tab = "issues" | "columns" | "versions" | "ask-ai";

export default function DetailsModal({ dataset, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("issues");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeVersionId, setActiveVersionId] = useState<number | null>(dataset.version_id);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (activeVersionId) {
      fetchProfile(activeVersionId).then(setProfile).catch(() => setProfile(null));
    }
  }, [activeVersionId]);

  function handleSelectVersion(versionId: number) {
    setProfile(null);
    setActiveVersionId(versionId);
    setTab("issues");
  }

  async function handleDownloadExcel() {
    if (!activeVersionId) return;
    setDownloadError("");
    try {
      await downloadReport(activeVersionId, dataset.file_name);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Report download fail ho gaya.");
    }
  }

  const tabClass = (name: Tab) =>
    `px-4 py-2 text-sm font-semibold transition ${
      tab === name ? "text-[#4f2d7f] border-b-2 border-[#4f2d7f]" : "text-gray-400"
    }`;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg h-[600px] flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{dataset.file_name}</h2>
            <p className="text-sm text-gray-500">{dataset.system} · {dataset.reporting_period}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="flex border-b border-[#e5e2dc] mb-4">
          <button onClick={() => setTab("issues")} className={tabClass("issues")}>Quality Issues</button>
          <button onClick={() => setTab("columns")} className={tabClass("columns")}>Column Metrics</button>
          <button onClick={() => setTab("versions")} className={tabClass("versions")}>Versions</button>
          <button onClick={() => setTab("ask-ai")} className={tabClass("ask-ai")}>Ask AI</button>
        </div>

        {tab === "versions" ? (
          <VersionsPanel dataset={dataset} activeVersionId={activeVersionId} onSelect={handleSelectVersion} />
        ) : !profile ? (
          <p className="text-gray-400 text-sm">Loading profile...</p>
        ) : tab === "issues" ? (
          <div className="overflow-y-auto flex-1">
            <div className="flex gap-4 mb-1">
              <button onClick={handleDownloadExcel} className="text-[#4f2d7f] text-sm font-semibold hover:underline">
                Download Excel report
              </button>
            </div>
            {downloadError && <p className="text-red-600 text-xs mb-3">{downloadError}</p>}
            <div className="grid grid-cols-3 gap-3 mb-6 mt-3">
              <div className="bg-[#f7f6f3] rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Total Records</p>
                <p className="text-lg font-bold text-gray-900">{profile.row_count?.toLocaleString() ?? "—"}</p>
              </div>
              <div className="bg-[#f7f6f3] rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Errors</p>
                <p className="text-lg font-bold text-red-600">
                  {profile.issues.filter((i) => i.severity === "error").length}
                </p>
              </div>
              <div className="bg-[#f7f6f3] rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Warnings</p>
                <p className="text-lg font-bold text-[#854f0b]">
                  {profile.issues.filter((i) => i.severity === "warning").length}
                </p>
              </div>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Quality issues</h3>
            {profile.issues.length === 0 ? (
              <p className="text-sm text-gray-500">Koi issue nahi mila is dataset mein.</p>
            ) : (
              <div className="space-y-2">
                {profile.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: issue.severity === "error" ? "#fef2f2" : "#fdf6ec" }}>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ background: issue.severity === "error" ? "#b91c1c" : "#854f0b" }}
                    >
                      {issue.severity.toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{issue.column ?? "Overall"}</p>
                      <p className="text-sm text-gray-600">{issue.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === "columns" ? (
          <ColumnMetricsPanel columns={profile.columns ?? []} />
        ) : (
          <ChatPanel datasetName={dataset.file_name} issues={profile.issues} />
        )}
      </div>
    </div>
  );
}
