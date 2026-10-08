"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import AuditLogTable from "../../components/AuditLogTable";
import { AuditEntry, CurrentUser } from "../../lib/types";
import { fetchAuditLogs, fetchCurrentUser } from "../../lib/api";

export default function AuditPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setEntries(await fetchAuditLogs(500));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit trail load nahi ho paya.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const user = await fetchCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      // UI guard sirf convenience ke liye - asli permission backend (/audit-logs) check karta hai
      if (user.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      setCurrentUser(user);
      load();
    })();
  }, [router, load]);

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <Navbar variant="authenticated" userName={currentUser.username} userRole={currentUser.role} />
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit trail</h1>
            <p className="text-sm text-gray-500">Kisne, kab, kya kiya - login, upload, download, rule changes.</p>
          </div>
          <button
            onClick={load}
            className="border border-[#cbc4bc] text-gray-700 px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-50 transition"
          >
            Refresh
          </button>
        </div>
        {error && <p className="text-red-600 text-sm mb-4 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <AuditLogTable entries={entries} />
      </div>
    </main>
  );
}
