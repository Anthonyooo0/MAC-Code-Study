import { useState, useEffect, useRef } from "react";
import type { ChangeEntry } from "./types";
import { supabase } from "./supabase";
import ChangeCard from "./components/ChangeCard";
import Calendar from "./components/Calendar";

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

// Map Supabase row → ChangeEntry
function rowToEntry(row: any): ChangeEntry {
  return {
    id: row.id,
    timestamp: row.timestamp,
    project: row.project,
    commitHash: row.commit_hash,
    commitMessage: row.commit_message,
    diff: row.diff,
    filesChanged: row.files_changed || [],
    author: row.author,
    reviewed: row.reviewed,
    notes: row.notes || "",
    aiExplanation: row.ai_explanation || null,
  };
}

export default function App() {
  const [entries, setEntries] = useState<ChangeEntry[]>([]);
  const [filter, setFilter] = useState<"all" | "unreviewed" | "reviewed">("all");
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayDate());
  const [loadingFile, setLoadingFile] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(
    localStorage.getItem("gemini-api-key") || ""
  );
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch today's entries from Supabase
  async function fetchEntries(forDate: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("code_changes")
      .select("*")
      .eq("date", forDate)
      .order("created_at", { ascending: true });

    if (!error && data) {
      setEntries(data.map(rowToEntry));
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchEntries(date);
  }, [date]);

  // Real-time subscription — new commits appear instantly
  useEffect(() => {
    const channel = supabase
      .channel("code-changes-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "code_changes" },
        (payload) => {
          const newEntry = rowToEntry(payload.new);
          if (newEntry.timestamp.startsWith(date)) {
            setEntries((prev) => {
              // Avoid duplicates
              if (prev.some((e) => e.id === newEntry.id)) return prev;
              return [...prev, newEntry];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "code_changes" },
        (payload) => {
          const updated = rowToEntry(payload.new);
          setEntries((prev) =>
            prev.map((e) => (e.id === updated.id ? updated : e))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [date]);

  // Persist review toggle to Supabase
  async function handleToggleReview(id: string) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const newVal = !entry.reviewed;
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, reviewed: newVal } : e))
    );
    await supabase.from("code_changes").update({ reviewed: newVal }).eq("id", id);
  }

  // Persist notes to Supabase
  async function handleSaveNote(id: string, note: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, notes: note } : e))
    );
    await supabase.from("code_changes").update({ notes: note }).eq("id", id);
  }

  // Persist AI explanation to Supabase
  async function handleExplain(id: string, explanation: string) {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, aiExplanation: explanation } : e))
    );
    await supabase
      .from("code_changes")
      .update({ ai_explanation: explanation })
      .eq("id", id);
  }

  // Upload a local JSON log file and import into Supabase
  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadingFile(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.entries && Array.isArray(parsed.entries)) {
          const rows = parsed.entries.map((entry: any) => ({
            date: parsed.date || todayDate(),
            timestamp: entry.timestamp,
            project: entry.project,
            commit_hash: entry.commitHash,
            commit_message: entry.commitMessage,
            diff: entry.diff,
            files_changed: entry.filesChanged || [],
            author: entry.author || "Unknown",
            reviewed: entry.reviewed || false,
            notes: entry.notes || "",
            ai_explanation: entry.aiExplanation || null,
          }));
          await supabase.from("code_changes").upsert(rows, {
            onConflict: "id",
            ignoreDuplicates: true,
          });
          // Refresh
          fetchEntries(parsed.date || date);
        }
      } catch {
        alert("Invalid JSON file.");
      }
      setLoadingFile(false);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function saveApiKey() {
    localStorage.setItem("gemini-api-key", apiKeyInput);
    setShowKeyModal(false);
  }

  const filtered =
    filter === "all"
      ? entries
      : filter === "reviewed"
      ? entries.filter((e) => e.reviewed)
      : entries.filter((e) => !e.reviewed);

  const reviewedCount = entries.filter((e) => e.reviewed).length;
  const explainedCount = entries.filter((e) => e.aiExplanation).length;
  const progress =
    entries.length > 0 ? (reviewedCount / entries.length) * 100 : 0;

  const hasKey = true;

  // Navigate dates
  function shiftDate(days: number) {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-black border border-white/10 rounded-xl w-full max-w-md p-6 fade-in">
            <h2 className="text-lg font-bold mb-1">Gemini API Key</h2>
            <p className="text-sm text-white/40 mb-5">
              Override the default key. Stored locally in your browser.
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-4 py-3 rounded-lg bg-white/[0.03] border border-white/10 text-white text-sm outline-none focus:border-white/25 placeholder:text-white/20 font-mono"
            />
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveApiKey}
                className="px-5 py-2 rounded-lg border border-white/20 text-sm font-semibold text-white/80 hover:text-white hover:border-white/40 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-5 pb-16">
        {/* Header */}
        <div className="pt-10 pb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <img src="/mac_logo.png" alt="MAC" className="w-7 h-7 object-contain" />
              <span className="text-[10px] font-bold tracking-[0.15em] text-white/30 uppercase font-mono">
                Code Study
              </span>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/50 pulse-dot" />
                <span className="text-[10px] font-mono text-white/20">LIVE</span>
              </div>
            </div>
            <button
              onClick={() => setShowKeyModal(true)}
              className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                hasKey
                  ? "border-white/10 text-white/30 hover:text-white/60"
                  : "border-white/20 text-white/50 hover:text-white"
              }`}
            >
              {hasKey ? "API Key" : "Set API Key"}
            </button>
          </div>

          <h1 className="text-3xl font-bold text-white/90 tracking-tight mb-1">
            Daily Code Review
          </h1>

          {/* Date nav */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => shiftDate(-1)}
              className="text-white/20 hover:text-white/60 text-sm transition-colors"
            >
              ←
            </button>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="text-sm text-white/30 font-mono hover:text-white/60 transition-colors"
            >
              {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </button>
            <button
              onClick={() => shiftDate(1)}
              className="text-white/20 hover:text-white/60 text-sm transition-colors"
            >
              →
            </button>
            {date !== todayDate() && (
              <button
                onClick={() => setDate(todayDate())}
                className="text-[10px] font-mono text-white/25 hover:text-white/50 border border-white/10 px-2 py-0.5 rounded transition-all"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Calendar */}
        {showCalendar && (
          <div className="mb-6">
            <Calendar
              selectedDate={date}
              onSelectDate={(d) => {
                setDate(d);
                setShowCalendar(false);
              }}
            />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Changes", value: entries.length },
            { label: "Reviewed", value: reviewedCount },
            { label: "Explained", value: explainedCount },
            { label: "Remaining", value: entries.length - reviewedCount },
          ].map((s, i) => (
            <div
              key={i}
              className="px-4 py-3 rounded-lg border border-white/[0.06]"
            >
              <div className="text-[10px] font-bold tracking-wider text-white/25 uppercase font-mono mb-1">
                {s.label}
              </div>
              <div className="text-2xl font-bold text-white/70">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div className="h-1 rounded-full bg-white/[0.06] mb-6 overflow-hidden">
          <div
            className="h-full rounded-full bg-white/30 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex gap-1 bg-white/[0.02] rounded-lg p-0.5">
            {(
              [
                { key: "all", label: `All (${entries.length})` },
                {
                  key: "unreviewed",
                  label: `To Review (${entries.length - reviewedCount})`,
                },
                { key: "reviewed", label: `Done (${reviewedCount})` },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filter === t.key
                    ? "bg-white/[0.08] text-white/80"
                    : "text-white/30 hover:text-white/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-lg text-xs font-semibold border border-dashed border-white/15 text-white/30 hover:text-white/60 hover:border-white/30 transition-all"
          >
            {loadingFile ? "Importing..." : "Import JSON Log"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-2.5">
          {loading ? (
            <div className="py-16 text-center text-white/20 text-sm">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-white/20 text-sm">
              {entries.length === 0
                ? "No changes for this day. Start the tracker script and make some commits."
                : "All caught up — no changes match this filter."}
            </div>
          ) : (
            filtered.map((entry, i) => (
              <ChangeCard
                key={entry.id}
                entry={entry}
                index={i}
                onToggleReview={handleToggleReview}
                onSaveNote={handleSaveNote}
                onExplain={handleExplain}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
