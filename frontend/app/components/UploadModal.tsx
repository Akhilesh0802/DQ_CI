"use client";

import { useRef, useState } from "react";
import { uploadDataset } from "../lib/api";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const YEARS = ["2024", "2025", "2026", "2027"];
const SYSTEMS = ["SAP", "Oracle", "Snowflake", "Salesforce", "Workday", "NetSuite", "Microsoft Dynamics", "PeopleSoft"];

type Props = {
  onClose: () => void;
  onUploaded: () => void;
};

export default function UploadModal({ onClose, onUploaded }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [system, setSystem] = useState("");
  const [periodType, setPeriodType] = useState<"single" | "range">("single");
  const [periodMonth, setPeriodMonth] = useState("");
  const [periodYear, setPeriodYear] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [fromYear, setFromYear] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [toYear, setToYear] = useState("");
  const [formError, setFormError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  function handleSubmit() {
    if (!selectedFile || !system) {
      setFormError("File aur system chunna zaroori hai.");
      return;
    }
    let finalPeriod = "";
    if (periodType === "single") {
      if (!periodMonth || !periodYear) {
        setFormError("Month aur year chunna zaroori hai.");
        return;
      }
      finalPeriod = `${periodMonth}-${periodYear}`;
    } else {
      if (!fromMonth || !fromYear || !toMonth || !toYear) {
        setFormError("Range ke liye From aur To dono poore bharo.");
        return;
      }
      finalPeriod = `${fromMonth}-${fromYear} to ${toMonth}-${toYear}`;
    }
    setFormError("");
    setUploadProgress(0);

    const { promise, xhr } = uploadDataset(selectedFile, system, finalPeriod, setUploadProgress);
    activeXhrRef.current = xhr;

    promise
      .then(() => {
        onUploaded();
        onClose();
      })
      .catch((err: Error) => {
        if (err.message !== "Upload cancelled") {
          setFormError(`Upload fail ho gaya: ${err.message}`);
        }
        setUploadProgress(null);
      });
  }

  function handleCancelUpload() {
    activeXhrRef.current?.abort();
    setUploadProgress(null);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        {uploadProgress === null ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload dataset</h2>
            {formError && <p className="text-red-600 text-sm mb-4 bg-red-50 px-3 py-2 rounded">{formError}</p>}

            <label className="block text-sm text-gray-600 mb-1">File (CSV/Excel)</label>
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
              className="w-full border border-[#e5e2dc] rounded-lg px-3 py-2 mb-4 text-sm"
            />

            <label className="block text-sm text-gray-600 mb-1">System</label>
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="w-full border border-[#e5e2dc] rounded-lg px-3 py-2 mb-4 text-gray-900 bg-white"
            >
              <option value="">Select a system</option>
              {SYSTEMS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <label className="block text-sm text-gray-600 mb-1">Reporting period</label>
            <div className="flex mb-3 border border-[#e5e2dc] rounded-lg overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setPeriodType("single")}
                className={`flex-1 py-1.5 font-semibold transition ${periodType === "single" ? "bg-[#4f2d7f] text-white" : "bg-white text-gray-600"}`}
              >
                Single Month
              </button>
              <button
                type="button"
                onClick={() => setPeriodType("range")}
                className={`flex-1 py-1.5 font-semibold transition ${periodType === "range" ? "bg-[#4f2d7f] text-white" : "bg-white text-gray-600"}`}
              >
                Range
              </button>
            </div>

            {periodType === "single" ? (
              <div className="flex gap-3 mb-6">
                <select value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} className="flex-1 border border-[#e5e2dc] rounded-lg px-3 py-2 text-gray-900 bg-white">
                  <option value="">Month</option>
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} className="flex-1 border border-[#e5e2dc] rounded-lg px-3 py-2 text-gray-900 bg-white">
                  <option value="">Year</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            ) : (
              <div className="mb-6">
                <p className="text-xs text-gray-500 mb-1">From</p>
                <div className="flex gap-3 mb-3">
                  <select value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="flex-1 border border-[#e5e2dc] rounded-lg px-3 py-2 text-gray-900 bg-white">
                    <option value="">Month</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={fromYear} onChange={(e) => setFromYear(e.target.value)} className="flex-1 border border-[#e5e2dc] rounded-lg px-3 py-2 text-gray-900 bg-white">
                    <option value="">Year</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <p className="text-xs text-gray-500 mb-1">To</p>
                <div className="flex gap-3">
                  <select value={toMonth} onChange={(e) => setToMonth(e.target.value)} className="flex-1 border border-[#e5e2dc] rounded-lg px-3 py-2 text-gray-900 bg-white">
                    <option value="">Month</option>
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select value={toYear} onChange={(e) => setToYear(e.target.value)} className="flex-1 border border-[#e5e2dc] rounded-lg px-3 py-2 text-gray-900 bg-white">
                    <option value="">Year</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-[#cbc4bc] text-gray-700 rounded-lg py-2 font-semibold hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleSubmit} className="flex-1 bg-[#4f2d7f] text-white rounded-lg py-2 font-semibold hover:opacity-90 transition">
                Upload
              </button>
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Uploading...</h2>
            <p className="text-sm text-gray-500 mb-4 truncate">{selectedFile?.name}</p>
            <div className="w-full bg-[#f0ede7] rounded-full h-3 mb-2 overflow-hidden">
              <div className="bg-[#4f2d7f] h-3 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
            <p className="text-right text-sm text-gray-500 mb-6">{uploadProgress}%</p>
            <button onClick={handleCancelUpload} className="w-full border border-red-300 text-red-600 rounded-lg py-2 font-semibold hover:bg-red-50 transition">
              Cancel upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
