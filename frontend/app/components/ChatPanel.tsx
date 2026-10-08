"use client";

import { useEffect, useRef, useState } from "react";
import { ChatMessage, QualityIssue } from "../lib/types";

// TODO: jab Phase 3 (LangChain + Claude) backend banega, ye function ek
// real API call se replace hogi - baaki poora chat UI same rahega.
function generateMockAIResponse(question: string, issues: QualityIssue[]): string {
  const q = question.toLowerCase();

  if (q.includes("major") || q.includes("concern") || q.includes("important")) {
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length === 0) return "Koi major error nahi mila is dataset mein — sirf kuch minor warnings hain.";
    return `Sabse major concerns ye hain:\n${errors.map((e) => `• ${e.column ?? "overall"}: ${e.message}`).join("\n")}`;
  }
  if (q.includes("duplicate")) {
    const dupIssue = issues.find((i) => i.message.toLowerCase().includes("duplicate"));
    return dupIssue ? dupIssue.message : "Is dataset mein koi duplicate issue detect nahi hua.";
  }
  if (issues.length === 0) return "Is dataset mein abhi tak koi quality issue detect nahi hua.";
  return `Columns/areas jinme issues hain: ${issues.map((i) => i.column ?? "overall").join(", ")}.`;
}

type Props = {
  datasetName: string;
  issues: QualityIssue[];
};

export default function ChatPanel({ datasetName, issues }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: `Hi! Main "${datasetName}" ke profiling results ke baare mein sawalon ke jawab de sakta hun.` },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    if (!input.trim()) return;
    const userMessage: ChatMessage = { role: "user", text: input };
    const aiResponse: ChatMessage = { role: "assistant", text: generateMockAIResponse(input, issues) };
    setMessages((prev) => [...prev, userMessage, aiResponse]);
    setInput("");
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className="max-w-[80%] rounded-2xl px-4 py-2 text-sm whitespace-pre-line"
              style={{ background: msg.role === "user" ? "#4f2d7f" : "#f0ede7", color: msg.role === "user" ? "#fff" : "#2c2c2a" }}
            >
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-[#e5e2dc]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Poochho: 'Major concerns kya hain?'"
          className="flex-1 border border-[#e5e2dc] rounded-full px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#4f2d7f]"
        />
        <button onClick={handleSend} className="bg-[#4f2d7f] text-white rounded-full px-5 py-2 text-sm font-semibold hover:opacity-90 transition">
          Send
        </button>
      </div>
    </div>
  );
}
