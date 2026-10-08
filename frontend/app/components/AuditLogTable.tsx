"use client";

import { useMemo, useState } from "react";
import { AuditEntry } from "../lib/types";
import { formatServerDateTime } from "../lib/format";

type Props = {
  entries: AuditEntry[];
};

export default function AuditLogTable({ entries }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      [e.username, String(e.user_id), e.action, e.details ?? ""].some((v) => v.toLowerCase().includes(q))
    );
  }, [entries, query]);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter: user, user id, action ya details (jaise 'upload', 'priya', '3')"
        className="w-full border border-[#e5e2dc] rounded-lg px-3 py-2 mb-4 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#4f2d7f]"
      />
      <div className="bg-white rounded-xl overflow-hidden overflow-x-auto" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#f0ede7] text-gray-600">
            <tr>
              <th className="px-4 py-3 whitespace-nowrap">Date &amp; time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">Koi entry nahi mili.</td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-[#eee]">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {formatServerDateTime(e.created_at)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="font-medium text-gray-900">{e.username}</span>
                  <span className="text-xs text-gray-400 ml-1">#{e.user_id}</span>
                </td>
                <td className="px-4 py-3 font-semibold text-[#4f2d7f]">{e.action}</td>
                <td className="px-4 py-3 text-gray-600">{e.details || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">{filtered.length} of {entries.length} entries (latest pehle)</p>
    </div>
  );
}
