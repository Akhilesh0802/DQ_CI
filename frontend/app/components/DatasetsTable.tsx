"use client";

import { Dataset } from "../lib/types";
import { formatServerDateTime } from "../lib/format";

type Props = {
  datasets: Dataset[];
  showOwner: boolean; // admin ke liye true - kiska dataset hai
  canUpload: boolean; // viewer ke liye false
  hasActiveUpload: boolean; // is user ka koi upload abhi chal raha hai (ek time pe ek hi)
  busyPdfVersionId: number | null; // jis version ka PDF abhi ban raha hai
  onViewDetails: (dataset: Dataset) => void;
  onDownloadLog: (dataset: Dataset) => void;
  onDownloadPdf: (dataset: Dataset) => void;
  onNewVersion: (dataset: Dataset) => void;
  onCancel: (dataset: Dataset) => void;
};

// Status sirf rang se nahi, text se bhi pehchana jaata hai
const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  uploaded: { label: "Queued", className: "bg-[#e8e0f5] text-[#4f2d7f]" },
  processing: { label: "Running…", className: "bg-[#e8e0f5] text-[#4f2d7f]" },
  done: { label: "Done", className: "bg-[#dff1e4] text-[#17622f]" },
  failed: { label: "Failed", className: "bg-[#fbdcdc] text-[#8a1c1c]" },
  cancelled: { label: "Cancelled", className: "bg-[#fbdcdc] text-[#8a1c1c]" },
};

const linkClass = "text-[#4f2d7f] font-bold hover:underline";
const dash = <span className="text-gray-400">—</span>;

export default function DatasetsTable({
  datasets,
  showOwner,
  canUpload,
  hasActiveUpload,
  busyPdfVersionId,
  onViewDetails,
  onDownloadLog,
  onDownloadPdf,
  onNewVersion,
  onCancel,
}: Props) {
  const columnCount = showOwner ? 10 : 9;
  const th = "px-4 py-4 text-[13px] font-bold text-[#5b5370] whitespace-nowrap";

  return (
    <div className="bg-white rounded-2xl overflow-hidden overflow-x-auto" style={{ boxShadow: "0 8px 28px rgba(45,22,80,0.08)" }}>
      <table className="w-full text-left text-sm">
        <thead className="bg-[#f1eeea]">
          <tr>
            <th className={th}>Uploaded</th>
            {showOwner && <th className={th}>Owner</th>}
            <th className={th}>File name</th>
            <th className={th}>System</th>
            <th className={th}>Period</th>
            <th className={th}>Records</th>
            <th className={th}>Status</th>
            <th className={th}>Log</th>
            <th className={th}>PDF</th>
            <th className={`${th} text-right`}>Details</th>
          </tr>
        </thead>
        <tbody>
          {datasets.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="px-4 py-8 text-center text-gray-400">
                Koi dataset nahi mila.
              </td>
            </tr>
          )}
          {datasets.map((dataset) => {
            const isActive = dataset.status === "processing" || dataset.status === "uploaded";
            const isDone = dataset.status === "done";
            const status = STATUS_STYLES[dataset.status ?? ""];
            const pdfBusy = busyPdfVersionId !== null && busyPdfVersionId === dataset.version_id;
            return (
              <tr key={dataset.id} className="border-t border-[#eee9e3]">
                <td className="px-4 py-4 text-[#5b5370] text-xs whitespace-nowrap">
                  {formatServerDateTime(dataset.uploaded_at)}
                </td>
                {showOwner && (
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="font-semibold text-gray-900">{dataset.owner_username ?? "—"}</span>
                    <span className="text-xs text-gray-400 ml-1">#{dataset.owner_id}</span>
                  </td>
                )}
                <td className="px-4 py-4">
                  <div className="font-semibold text-gray-900">
                    {dataset.file_name}
                    <span className="ml-2 text-xs font-normal text-gray-400">v{dataset.version_number ?? 1}</span>
                  </div>
                  {canUpload && !isActive && (
                    <button
                      onClick={() => onNewVersion(dataset)}
                      disabled={hasActiveUpload}
                      title={hasActiveUpload ? "Aapka ek upload abhi chal raha hai - uske baad" : "Is dataset ka naya version upload karo"}
                      className="mt-0.5 text-xs text-[#4f2d7f] font-bold hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
                    >
                      + New version
                    </button>
                  )}
                </td>
                <td className="px-4 py-4">{dataset.system ?? "—"}</td>
                <td className="px-4 py-4 whitespace-nowrap">{dataset.reporting_period ?? "—"}</td>
                <td className="px-4 py-4">{dataset.record_count?.toLocaleString() ?? "—"}</td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {status ? (
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${status.className}`}>{status.label}</span>
                  ) : (
                    dash
                  )}
                  {isActive && (
                    <button onClick={() => onCancel(dataset)} className="ml-3 text-xs text-red-700 font-bold hover:underline">
                      Cancel
                    </button>
                  )}
                </td>
                <td className="px-4 py-4">
                  {dataset.version_id ? (
                    <button
                      onClick={() => onDownloadLog(dataset)}
                      title="Ab tak ka processing log (running/failed job ka bhi)"
                      className={linkClass}
                    >
                      Download
                    </button>
                  ) : (
                    dash
                  )}
                </td>
                <td className="px-4 py-4">
                  {isDone && dataset.version_id ? (
                    <button
                      onClick={() => onDownloadPdf(dataset)}
                      disabled={pdfBusy}
                      title="Column matrix ke saath structured PDF summary"
                      className={`${linkClass} disabled:text-gray-400 disabled:no-underline`}
                    >
                      {pdfBusy ? "Preparing…" : "PDF"}
                    </button>
                  ) : (
                    dash
                  )}
                </td>
                <td className="px-4 py-4 text-right">
                  {isDone ? (
                    <button onClick={() => onViewDetails(dataset)} className={linkClass}>
                      View
                    </button>
                  ) : (
                    dash
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
