"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import UploadModal from "../components/UploadModal";
import DatasetsTable from "../components/DatasetsTable";
import DetailsModal from "../components/DetailsModal";
import NewVersionModal from "../components/NewVersionModal";
import StatusFilter, { StatusFilterValue, matchesFilter } from "../components/StatusFilter";
import { CurrentUser, Dataset } from "../lib/types";
import { cancelVersion, fetchCurrentUser, fetchDatasets, fetchProfile, downloadLog } from "../lib/api";
import { downloadSummaryPdf } from "../lib/pdf";

export default function DashboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loadError, setLoadError] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [newVersionFor, setNewVersionFor] = useState<Dataset | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [busyPdfVersionId, setBusyPdfVersionId] = useState<number | null>(null);

  const loadDatasets = useCallback(async () => {
    try {
      const data = await fetchDatasets();
      setDatasets(data);
      setLoadError("");
    } catch {
      setLoadError("Datasets load nahi ho paye. Backend chal raha hai kya?");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const user = await fetchCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setCurrentUser(user);
      loadDatasets();
    })();
  }, [router, loadDatasets]);

  // Jab tak koi dataset abhi bhi process ho raha hai, har 2 second mein list refresh karo
  useEffect(() => {
    const hasProcessing = datasets.some((d) => d.status === "processing" || d.status === "uploaded");
    if (!hasProcessing) return;
    const interval = setInterval(loadDatasets, 2000);
    return () => clearInterval(interval);
  }, [datasets, loadDatasets]);

  async function handleDownloadLog(dataset: Dataset) {
    if (!dataset.version_id) return;
    try {
      await downloadLog(dataset.version_id, dataset.file_name);
    } catch {
      setLoadError("Log download fail ho gaya.");
    }
  }

  async function handleDownloadPdf(dataset: Dataset) {
    if (!dataset.version_id) return;
    setBusyPdfVersionId(dataset.version_id);
    try {
      const profile = await fetchProfile(dataset.version_id);
      downloadSummaryPdf(dataset, profile);
      setLoadError("");
    } catch {
      setLoadError("PDF nahi ban paya. Dobara try karo.");
    } finally {
      setBusyPdfVersionId(null);
    }
  }

  async function handleCancel(dataset: Dataset) {
    if (!dataset.version_id) return;
    if (!window.confirm(`"${dataset.file_name}" ki processing cancel karni hai?`)) return;
    try {
      await cancelVersion(dataset.version_id);
      setLoadError("");
      loadDatasets();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Cancel nahi ho paya.");
    }
  }

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  // Server ka rule: ek user ke paas ek time pe ek hi active upload. UI sirf pehle se bata deta hai (asli check server karta hai).
  const hasActiveUpload = datasets.some(
    (d) => (d.status === "processing" || d.status === "uploaded") && d.uploaded_by === currentUser.id
  );
  const canUpload = currentUser.role !== "viewer";

  return (
    <main className="min-h-screen bg-[#faf8f5] font-body text-[#1d1530]">
      <Navbar variant="authenticated" userName={currentUser.username} userRole={currentUser.role} />

      <div className="max-w-7xl mx-auto px-8 pt-10 pb-12">
        <div className="flex justify-between items-end mb-6">
          <div>
            <div className="text-[13px] tracking-[0.15em] uppercase font-bold text-[#4f2d7f] mb-1.5">Data Quality Tool</div>
            <h1 className="font-display font-bold text-[40px] leading-tight tracking-[-0.02em]">
              {currentUser.role === "admin" ? "All datasets" : "Datasets"}
            </h1>
            {currentUser.role === "admin" && (
              <p className="text-sm text-[#5b5370] mt-1">Sabhi users ke datasets, owner ke saath.</p>
            )}
          </div>
          {canUpload && (
            <button
              onClick={() => setIsUploadModalOpen(true)}
              disabled={hasActiveUpload}
              title={hasActiveUpload ? "Aapka ek upload abhi chal raha hai - complete ya cancel hone ke baad" : undefined}
              className="h-[50px] px-7 bg-[#4f2d7f] text-white rounded-full text-[15px] font-bold hover:bg-[#3f2366] transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              + Upload dataset
            </button>
          )}
        </div>

        {loadError && <p role="alert" className="text-red-700 text-sm mb-4 bg-red-50 px-3 py-2 rounded-lg">{loadError}</p>}

        <StatusFilter datasets={datasets} value={statusFilter} onChange={setStatusFilter} />

        <DatasetsTable
          datasets={datasets.filter((d) => matchesFilter(d, statusFilter))}
          showOwner={currentUser.role === "admin"}
          canUpload={canUpload}
          hasActiveUpload={hasActiveUpload}
          busyPdfVersionId={busyPdfVersionId}
          onViewDetails={setSelectedDataset}
          onDownloadLog={handleDownloadLog}
          onDownloadPdf={handleDownloadPdf}
          onNewVersion={setNewVersionFor}
          onCancel={handleCancel}
        />
      </div>

      {isUploadModalOpen && (
        <UploadModal onClose={() => setIsUploadModalOpen(false)} onUploaded={loadDatasets} />
      )}

      {newVersionFor && (
        <NewVersionModal dataset={newVersionFor} onClose={() => setNewVersionFor(null)} onUploaded={loadDatasets} />
      )}

      {selectedDataset && (
        <DetailsModal dataset={selectedDataset} onClose={() => setSelectedDataset(null)} />
      )}
    </main>
  );
}
