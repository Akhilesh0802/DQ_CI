"use client";

import { useState } from "react";
import { Rule } from "../lib/types";
import { resetRule, updateRule } from "../lib/api";

type Props = {
  rule: Rule;
  onChanged: (rule: Rule) => void;
};

export default function RuleEditor({ rule, onChanged }: Props) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [threshold, setThreshold] = useState(String(rule.threshold));
  const [severity, setSeverity] = useState<"warning" | "error">(rule.severity);
  const [excluded, setExcluded] = useState(rule.excluded_columns.join(", "));
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  function applyRule(r: Rule) {
    setEnabled(r.enabled);
    setThreshold(String(r.threshold));
    setSeverity(r.severity);
    setExcluded(r.excluded_columns.join(", "));
  }

  async function handleSave() {
    const value = Number(threshold);
    if (threshold.trim() === "" || Number.isNaN(value) || value < 0) {
      setMessage({ text: "Threshold 0 ya usse bada number hona chahiye.", ok: false });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const saved = await updateRule(rule.key, {
        threshold: value,
        severity,
        enabled,
        excluded_columns: excluded.split(",").map((c) => c.trim()).filter(Boolean),
      });
      applyRule(saved);
      onChanged(saved);
      setMessage({ text: "Saved. Naye uploads par lagega.", ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Save nahi ho paya.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setBusy(true);
    setMessage(null);
    try {
      const restored = await resetRule(rule.key);
      applyRule(restored);
      onChanged(restored);
      setMessage({ text: "Default par wapas aa gaya.", ok: true });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Reset nahi ho paya.", ok: false });
    } finally {
      setBusy(false);
    }
  }

  const operator = rule.key === "format_mismatch" ? "≥" : ">";
  const inputClass =
    "w-full border border-[#e5e2dc] rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4f2d7f]";

  return (
    <div className="bg-white rounded-xl p-5" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{rule.label}</h2>
          <p className="text-sm text-gray-500 max-w-xl">{rule.description}</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {enabled ? "On" : "Off"}
        </label>
      </div>

      <div className={`grid gap-4 mt-4 ${rule.column_level ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Threshold ({operator} kitna {rule.unit === "%" ? "%" : "rows"})
          </label>
          <input
            type="number"
            min={0}
            max={rule.unit === "%" ? 100 : undefined}
            step="any"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as "warning" | "error")}
            className={`${inputClass} bg-white`}
          >
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
        {rule.column_level && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Skip columns (comma se alag)</label>
            <input
              type="text"
              value={excluded}
              onChange={(e) => setExcluded(e.target.value)}
              placeholder="notes, remarks"
              className={inputClass}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={busy}
          className="bg-[#4f2d7f] text-white px-5 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          Save
        </button>
        <button
          onClick={handleReset}
          disabled={busy || rule.is_default}
          className="border border-[#cbc4bc] text-gray-700 px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-50 transition disabled:opacity-40"
        >
          Reset to default
        </button>
        {message && (
          <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
