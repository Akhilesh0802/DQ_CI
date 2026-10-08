"use client";

import { useRef, useState } from "react";
import { uploadNewVersion } from "../lib/api";
import { Dataset } from "../lib/types";

type Props = {
  dataset: Dataset;
  onClose: () => void;
  onUploaded: () => void;
};

export default function NewVersionModal({ dataset, onClose, onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  function handleUpload() {
    if (!file) {
      setError("Pehle file chuno.");
      return;
    }
    setError("");
    setProgress(0);
    const { promise, xhr } = uploadNewVersion(dataset.id, file, setProgress);
    xhrRef.current = xhr;
    promise
      .then(() => {
        onUploaded();
        onClose();
      })
      .catch((err: Error) => {
        if (err.message !== "Upload cancelled") setError(err.message);
        setProgress(null);
      });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        {progress === null ? (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Upload new version</h2>
            <p className="text-sm text-gray-500 mb-4">
              {dataset.file_name} · {dataset.system} · {dataset.reporting_period}
              <br />
              System aur period wahi rahenge; sirf naya file jodta hai (v{(dataset.version_number ?? 1) + 1}).
            </p>
            {error && <p className="text-red-600 text-sm mb-4 bg-red-50 px-3 py-2 rounded">{error}</p>}
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              className="w-full border border-[#e5e2dc] rounded-lg px-3 py-2 mb-6 text-sm"
            />
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 border border-[#cbc4bc] text-gray-700 rounded-lg py-2 font-semibold hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={handleUpload} className="flex-1 bg-[#4f2d7f] text-white rounded-lg py-2 font-semibold hover:opacity-90 transition">
                Upload
              </button>
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Uploading...</h2>
            <p className="text-sm text-gray-500 mb-4 truncate">{file?.name}</p>
            <div className="w-full bg-[#f0ede7] rounded-full h-3 mb-2 overflow-hidden">
              <div className="bg-[#4f2d7f] h-3 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-right text-sm text-gray-500 mb-6">{progress}%</p>
            <button
              onClick={() => xhrRef.current?.abort()}
              className="w-full border border-red-300 text-red-600 rounded-lg py-2 font-semibold hover:bg-red-50 transition"
            >
              Cancel upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
