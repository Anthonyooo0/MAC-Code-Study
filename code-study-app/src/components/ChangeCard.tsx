import { useState } from "react";
import type { ChangeEntry } from "../types";
import DiffViewer from "./DiffViewer";
import AiExplanation from "./AiExplanation";

interface Props {
  entry: ChangeEntry;
  index: number;
  onToggleReview: (id: string) => void;
  onSaveNote: (id: string, note: string) => void;
  onExplain: (id: string, explanation: string) => void;
}

function getCommitType(msg: string) {
  const lower = msg.toLowerCase();
  if (lower.startsWith("fix")) return "FIX";
  if (lower.startsWith("feat")) return "FEAT";
  if (lower.startsWith("refactor")) return "REFACTOR";
  if (lower.startsWith("docs")) return "DOCS";
  if (lower.startsWith("style")) return "STYLE";
  if (lower.startsWith("test")) return "TEST";
  return "CHANGE";
}

export default function ChangeCard({
  entry,
  index,
  onToggleReview,
  onSaveNote,
  onExplain,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(entry.notes || "");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const commitType = getCommitType(entry.commitMessage);
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div
      className="border border-white/[0.06] rounded-xl overflow-hidden transition-all duration-300 hover:border-white/[0.12] fade-in"
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      {/* Header — clickable */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="px-5 py-4 cursor-pointer flex items-center gap-4 select-none"
      >
        {/* Number */}
        <div className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-xs font-bold text-white/50 flex-shrink-0">
          {index + 1}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border border-white/10 text-white/50 font-mono">
              {commitType}
            </span>
            <span className="text-xs text-white/25 font-mono">
              {entry.commitHash}
            </span>
            <span className="text-xs text-white/20">{time}</span>
          </div>
          <div className="text-sm font-medium text-white/80 truncate">
            {entry.commitMessage}
          </div>
          <div className="text-xs text-white/25 mt-1">
            {entry.filesChanged.length} file
            {entry.filesChanged.length !== 1 ? "s" : ""} changed
            <span className="mx-1.5">·</span>
            {entry.project}
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {entry.reviewed && (
            <span className="text-[10px] font-bold text-white/40 px-2 py-1 rounded border border-white/10">
              REVIEWED
            </span>
          )}
          {entry.aiExplanation && (
            <span className="text-[10px] font-bold text-white/30 px-2 py-1 rounded border border-white/[0.06]">
              EXPLAINED
            </span>
          )}
          <span
            className="text-lg text-white/20 transition-transform duration-300"
            style={{
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            ▾
          </span>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="px-5 pb-5 fade-in">
          {/* Files */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {entry.filesChanged.map((f, i) => (
              <span
                key={i}
                className="text-xs font-mono px-2.5 py-1 rounded-md bg-white/[0.03] border border-white/[0.06] text-white/40"
              >
                {f}
              </span>
            ))}
          </div>

          {/* Diff */}
          <DiffViewer diff={entry.diff} />

          {/* AI Explanation */}
          <AiExplanation entry={entry} onExplain={onExplain} />

          {/* Actions */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleReview(entry.id);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                entry.reviewed
                  ? "border-white/20 text-white/50"
                  : "border-white/10 text-white/30 hover:text-white/60 hover:border-white/20"
              }`}
            >
              {entry.reviewed ? "✓ Reviewed" : "Mark as Reviewed"}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowNoteInput(!showNoteInput);
              }}
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-white/10 text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
            >
              {entry.notes ? "Edit Note" : "Add Note"}
            </button>
          </div>

          {/* Note Input */}
          {showNoteInput && (
            <div className="mt-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What did you learn from this change? What would you do differently?"
                className="w-full min-h-[80px] px-4 py-3 rounded-lg bg-white/[0.03] border border-white/10 text-white/70 text-sm leading-relaxed resize-y outline-none focus:border-white/25 placeholder:text-white/20"
              />
              <button
                onClick={() => {
                  onSaveNote(entry.id, note);
                  setShowNoteInput(false);
                }}
                className="mt-2 px-4 py-2 rounded-lg border border-white/15 text-xs font-semibold text-white/50 hover:text-white/80 transition-all"
              >
                Save Note
              </button>
            </div>
          )}

          {/* Existing Note */}
          {entry.notes && !showNoteInput && (
            <div className="mt-3 px-4 py-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider">
                Your Note
              </span>
              <div className="mt-1.5 text-sm text-white/50 leading-relaxed">
                {entry.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
