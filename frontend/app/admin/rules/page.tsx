"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import RuleEditor from "../../components/RuleEditor";
import { CurrentUser, Rule } from "../../lib/types";
import { fetchCurrentUser, fetchRules } from "../../lib/api";

export default function RulesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const user = await fetchCurrentUser();
      if (!user) {
        router.push("/login");
        return;
      }
      // UI guard sirf convenience ke liye hai - asli permission backend (PUT/DELETE /rules) check karta hai
      if (user.role !== "admin") {
        router.push("/dashboard");
        return;
      }
      setCurrentUser(user);
      try {
        setRules(await fetchRules());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Rules load nahi ho paye.");
      }
    })();
  }, [router]);

  function handleChanged(updated: Rule) {
    setRules((prev) => prev.map((r) => (r.key === updated.key ? updated : r)));
  }

  if (!currentUser) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <main className="min-h-screen bg-[#f7f6f3]">
      <Navbar variant="authenticated" userName={currentUser.username} userRole={currentUser.role} />
      <div className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Data quality rules</h1>
        <p className="text-sm text-gray-500 mb-6">
          Yahan badlav sirf <b>aage ke uploads</b> par lagte hain; purani profiling jaisi thi waisi rahegi.
        </p>
        {error && <p className="text-red-600 text-sm mb-4 bg-red-50 px-3 py-2 rounded">{error}</p>}
        <div className="space-y-4">
          {rules.map((rule) => (
            <RuleEditor key={rule.key} rule={rule} onChanged={handleChanged} />
          ))}
        </div>
      </div>
    </main>
  );
}
