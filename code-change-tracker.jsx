import { useState, useEffect, useRef } from "react";

const SAMPLE_DATA = {
  date: "2026-03-25",
  entries: [
    {
      id: "a1b2c3d4",
      timestamp: "2026-03-25T09:15:00",
      project: "MAC-M2M-Assistant",
      commitHash: "1a2da74",
      commitMessage: "fix: Upgrade SQL retry to 2 attempts with better error context",
      diff: `diff --git a/azure-functions/m2m-query/index.js b/azure-functions/m2m-query/index.js
@@ -686,6 +686,33 @@
+    // Build correction context with the exact error and failed SQL
+    // Build error-specific correction guidance
+    let fixGuidance = '';
+    const errMsg = sqlErr.message || '';
+    if (/Incorrect syntax near/i.test(errMsg)) {
+      const near = errMsg.match(/near '([^']+)'/i);
+      fixGuidance = \`This is a SQL SYNTAX error near '\${near ? near[1] : '?'}'. Common causes:\\n\` +
+        '- Missing comma between columns in SELECT\\n' +
+        '- Unmatched parentheses in function calls like DATEADD()\\n' +
+        '- Backslash \\\\ characters (SQL Server does not use backslash escaping)\\n' +
+        '- Missing space between keywords\\n' +
+        'Rewrite the query from scratch with correct syntax.';
+    }`,
      filesChanged: ["azure-functions/m2m-query/index.js"],
      author: "Jimenez",
      reviewed: false,
      notes: "",
      aiExplanation: null
    },
    {
      id: "e5f6g7h8",
      timestamp: "2026-03-25T10:30:00",
      project: "MAC-M2M-Assistant",
      commitHash: "3c4d5e6",
      commitMessage: "feat: Add retry delay with exponential backoff for SQL queries",
      diff: `diff --git a/azure-functions/m2m-query/index.js
@@ -710,3 +710,15 @@
+    // Exponential backoff: wait before retrying
+    // attempt 1 = 1000ms, attempt 2 = 2000ms, etc.
+    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
+    await new Promise(resolve => setTimeout(resolve, delay));
+
+    context.log(\`Retrying SQL query (attempt \${attempt + 1}) after \${delay}ms...\`);`,
      filesChanged: ["azure-functions/m2m-query/index.js"],
      author: "Jimenez",
      reviewed: false,
      notes: "",
      aiExplanation: null
    },
    {
      id: "i9j0k1l2",
      timestamp: "2026-03-25T14:22:00",
      project: "MAC-M2M-Assistant",
      commitHash: "7f8g9h0",
      commitMessage: "refactor: Extract SQL error parser into utility function",
      diff: `diff --git a/azure-functions/shared/sql-utils.js b/azure-functions/shared/sql-utils.js
new file mode 100644
@@ -0,0 +1,28 @@
+/**
+ * parseSqlError - Extracts structured info from SQL Server errors
+ * @param {Error} err - The caught SQL error
+ * @returns {Object} Parsed error with type, location, suggestion
+ */
+function parseSqlError(err) {
+  const msg = err.message || '';
+  const result = { raw: msg, type: 'unknown', near: null, suggestion: '' };
+
+  if (/Incorrect syntax near/i.test(msg)) {
+    result.type = 'syntax';
+    const match = msg.match(/near '([^']+)'/i);
+    result.near = match ? match[1] : null;
+    result.suggestion = 'Check for missing commas, unmatched parens, or invalid escaping.';
+  } else if (/Invalid column name/i.test(msg)) {
+    result.type = 'column';
+    const match = msg.match(/column name '([^']+)'/i);
+    result.near = match ? match[1] : null;
+    result.suggestion = 'Verify the column exists in the table schema.';
+  }
+
+  return result;
+}
+
+module.exports = { parseSqlError };`,
      filesChanged: ["azure-functions/shared/sql-utils.js"],
      author: "Jimenez",
      reviewed: false,
      notes: "",
      aiExplanation: null
    }
  ]
};

// ─── Diff Parser ───
function parseDiff(raw) {
  const lines = raw.split("\n");
  return lines.map((line, i) => {
    let type = "context";
    if (line.startsWith("+") && !line.startsWith("+++")) type = "added";
    else if (line.startsWith("-") && !line.startsWith("---")) type = "removed";
    else if (line.startsWith("@@")) type = "header";
    else if (line.startsWith("diff ")) type = "file";
    return { text: line, type, key: i };
  });
}

// ─── Diff Viewer Component ───
function DiffViewer({ diff }) {
  const lines = parseDiff(diff);
  return (
    <div style={{
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
      fontSize: 12.5,
      lineHeight: 1.7,
      borderRadius: 10,
      overflow: "hidden",
      border: "1px solid var(--border)",
    }}>
      {lines.map((l) => {
        const bg =
          l.type === "added" ? "rgba(52,211,153,0.1)" :
          l.type === "removed" ? "rgba(248,113,113,0.1)" :
          l.type === "header" ? "rgba(147,130,220,0.08)" :
          l.type === "file" ? "rgba(255,255,255,0.03)" :
          "transparent";
        const color =
          l.type === "added" ? "#34d399" :
          l.type === "removed" ? "#f87171" :
          l.type === "header" ? "#9382dc" :
          l.type === "file" ? "rgba(255,255,255,0.4)" :
          "rgba(255,255,255,0.55)";
        const borderLeft =
          l.type === "added" ? "3px solid #34d399" :
          l.type === "removed" ? "3px solid #f87171" :
          "3px solid transparent";
        return (
          <div key={l.key} style={{
            padding: "1px 16px",
            background: bg,
            color,
            borderLeft,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}>
            {l.text || " "}
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Explanation Component ───
function AiExplanation({ entry, onExplain }) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState(entry.aiExplanation);

  async function handleExplain() {
    setLoading(true);
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: `You are a code mentor helping a developer learn from changes made by an AI coding assistant. 

Analyze this git diff and explain:
1. **What changed** — describe each modification in plain English
2. **Why this pattern** — explain the reasoning behind the approach
3. **Key concepts** — highlight any programming patterns, best practices, or techniques used
4. **Watch out for** — mention anything the developer should double-check or understand deeply

Keep it concise but educational. Use short paragraphs, not long lists.

Commit message: ${entry.commitMessage}
Files changed: ${entry.filesChanged.join(", ")}

Diff:
\`\`\`
${entry.diff}
\`\`\``
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.map(c => c.text || "").join("\n") || "Could not generate explanation.";
      setExplanation(text);
      onExplain(entry.id, text);
    } catch (err) {
      setExplanation("Failed to get explanation. Make sure you're connected to the internet.");
    }
    setLoading(false);
  }

  if (explanation) {
    return (
      <div style={{
        marginTop: 16,
        padding: 20,
        background: "linear-gradient(135deg, rgba(147,130,220,0.08), rgba(52,211,153,0.06))",
        borderRadius: 10,
        border: "1px solid rgba(147,130,220,0.2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 14, color: "#9382dc", fontWeight: 600 }}>✦ AI Breakdown</span>
        </div>
        <div style={{
          fontSize: 13.5,
          lineHeight: 1.75,
          color: "rgba(255,255,255,0.8)",
          whiteSpace: "pre-wrap",
        }}>
          {explanation}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleExplain}
      disabled={loading}
      style={{
        marginTop: 12,
        padding: "10px 20px",
        background: loading ? "rgba(147,130,220,0.15)" : "rgba(147,130,220,0.12)",
        border: "1px solid rgba(147,130,220,0.3)",
        borderRadius: 8,
        color: "#9382dc",
        fontSize: 13,
        fontWeight: 600,
        cursor: loading ? "wait" : "pointer",
        transition: "all 0.2s",
        fontFamily: "inherit",
      }}
      onMouseEnter={e => { if (!loading) e.target.style.background = "rgba(147,130,220,0.25)"; }}
      onMouseLeave={e => { if (!loading) e.target.style.background = "rgba(147,130,220,0.12)"; }}
    >
      {loading ? "⟳ Analyzing..." : "✦ Explain This Change"}
    </button>
  );
}

// ─── Change Card ───
function ChangeCard({ entry, index, onToggleReview, onSaveNote, onExplain }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState(entry.notes || "");
  const [showNoteInput, setShowNoteInput] = useState(false);

  const typeColors = {
    fix: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", text: "#fbbf24", label: "FIX" },
    feat: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", text: "#34d399", label: "FEATURE" },
    refactor: { bg: "rgba(147,130,220,0.1)", border: "rgba(147,130,220,0.3)", text: "#9382dc", label: "REFACTOR" },
    chore: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.15)", text: "rgba(255,255,255,0.5)", label: "CHORE" },
  };

  const msgLower = entry.commitMessage.toLowerCase();
  const commitType = msgLower.startsWith("fix") ? "fix"
    : msgLower.startsWith("feat") ? "feat"
    : msgLower.startsWith("refactor") ? "refactor"
    : "chore";
  const tc = typeColors[commitType];

  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", hour12: true
  });

  return (
    <div style={{
      background: "rgba(255,255,255,0.02)",
      border: `1px solid ${expanded ? tc.border : "rgba(255,255,255,0.06)"}`,
      borderRadius: 14,
      overflow: "hidden",
      transition: "all 0.3s ease",
      animation: `fadeSlideIn 0.4s ease ${index * 0.1}s both`,
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "18px 22px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 14,
          userSelect: "none",
        }}
      >
        {/* Number */}
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: tc.bg, border: `1px solid ${tc.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: tc.text, flexShrink: 0,
        }}>
          {index + 1}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
              padding: "2px 8px", borderRadius: 4,
              background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text,
            }}>
              {tc.label}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
              {entry.commitHash}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>{time}</span>
          </div>
          <div style={{
            fontSize: 14.5, fontWeight: 500, color: "rgba(255,255,255,0.85)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {entry.commitMessage}
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 3 }}>
            {entry.filesChanged.length} file{entry.filesChanged.length !== 1 ? "s" : ""} changed
            <span style={{ margin: "0 6px" }}>·</span>
            {entry.project}
          </div>
        </div>

        {/* Status indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {entry.reviewed && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: "#34d399",
              padding: "3px 8px", borderRadius: 4,
              background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)",
            }}>
              REVIEWED
            </span>
          )}
          <span style={{
            fontSize: 18, color: "rgba(255,255,255,0.25)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease",
          }}>
            ▾
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div style={{ padding: "0 22px 22px" }}>
          {/* Files list */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16,
          }}>
            {entry.filesChanged.map((f, i) => (
              <span key={i} style={{
                fontSize: 11.5, fontFamily: "monospace",
                padding: "4px 10px", borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.55)",
              }}>
                {f}
              </span>
            ))}
          </div>

          {/* Diff */}
          <DiffViewer diff={entry.diff} />

          {/* AI Explanation */}
          <AiExplanation entry={entry} onExplain={onExplain} />

          {/* Actions bar */}
          <div style={{
            marginTop: 16, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleReview(entry.id); }}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                border: entry.reviewed ? "1px solid rgba(52,211,153,0.3)" : "1px solid rgba(255,255,255,0.12)",
                background: entry.reviewed ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)",
                color: entry.reviewed ? "#34d399" : "rgba(255,255,255,0.5)",
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
              }}
            >
              {entry.reviewed ? "✓ Reviewed" : "Mark as Reviewed"}
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); setShowNoteInput(!showNoteInput); }}
              style={{
                padding: "8px 16px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.5)",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              ✎ {entry.notes ? "Edit Note" : "Add Note"}
            </button>
          </div>

          {/* Note Input */}
          {showNoteInput && (
            <div style={{ marginTop: 12 }}>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Write your notes about this change... What did you learn? What would you do differently?"
                style={{
                  width: "100%", minHeight: 80, padding: 14, borderRadius: 10,
                  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "inherit",
                  lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = "rgba(147,130,220,0.4)"}
                onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
              />
              <button
                onClick={() => { onSaveNote(entry.id, note); setShowNoteInput(false); }}
                style={{
                  marginTop: 8, padding: "8px 20px", borderRadius: 8,
                  background: "rgba(147,130,220,0.15)", border: "1px solid rgba(147,130,220,0.3)",
                  color: "#9382dc", fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Save Note
              </button>
            </div>
          )}

          {/* Existing note display */}
          {entry.notes && !showNoteInput && (
            <div style={{
              marginTop: 12, padding: 14,
              background: "rgba(251,191,36,0.05)",
              border: "1px solid rgba(251,191,36,0.15)",
              borderRadius: 10, fontSize: 13,
              color: "rgba(255,255,255,0.65)", lineHeight: 1.6,
            }}>
              <span style={{ color: "#fbbf24", fontSize: 11, fontWeight: 600 }}>YOUR NOTE</span>
              <div style={{ marginTop: 6 }}>{entry.notes}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main App ───
export default function CodeChangeTracker() {
  const [data, setData] = useState(null);
  const [filter, setFilter] = useState("all"); // all, unreviewed, reviewed
  const [loadingFile, setLoadingFile] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Load sample data on mount
    setData(SAMPLE_DATA);
  }, []);

  function handleToggleReview(id) {
    setData(prev => ({
      ...prev,
      entries: prev.entries.map(e =>
        e.id === id ? { ...e, reviewed: !e.reviewed } : e
      )
    }));
  }

  function handleSaveNote(id, note) {
    setData(prev => ({
      ...prev,
      entries: prev.entries.map(e =>
        e.id === id ? { ...e, notes: note } : e
      )
    }));
  }

  function handleExplain(id, explanation) {
    setData(prev => ({
      ...prev,
      entries: prev.entries.map(e =>
        e.id === id ? { ...e, aiExplanation: explanation } : e
      )
    }));
  }

  function handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoadingFile(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        setData(parsed);
      } catch {
        alert("Invalid JSON file. Please select a valid change log file.");
      }
      setLoadingFile(false);
    };
    reader.readAsText(file);
  }

  const entries = data?.entries || [];
  const filtered = filter === "all" ? entries
    : filter === "reviewed" ? entries.filter(e => e.reviewed)
    : entries.filter(e => !e.reviewed);

  const reviewedCount = entries.filter(e => e.reviewed).length;
  const progress = entries.length > 0 ? (reviewedCount / entries.length) * 100 : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "white",
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
      padding: "0 20px 60px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div style={{
        maxWidth: 820, margin: "0 auto", paddingTop: 40,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 6,
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#34d399",
            boxShadow: "0 0 12px rgba(52,211,153,0.4)",
            animation: "pulseGlow 2s ease infinite",
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: "0.15em",
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
          }}>
            Change Tracker
          </span>
        </div>

        <h1 style={{
          fontSize: 32, fontWeight: 700, margin: "0 0 4px",
          color: "rgba(255,255,255,0.92)",
          letterSpacing: "-0.02em",
        }}>
          Daily Code Review
        </h1>
        <p style={{
          fontSize: 15, color: "rgba(255,255,255,0.4)", margin: "0 0 28px",
        }}>
          {data?.date ? new Date(data.date + "T12:00:00").toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric"
          }) : "No data loaded"}
        </p>

        {/* Stats Row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24,
        }}>
          {[
            { label: "CHANGES", value: entries.length, color: "#9382dc" },
            { label: "REVIEWED", value: reviewedCount, color: "#34d399" },
            { label: "REMAINING", value: entries.length - reviewedCount, color: entries.length - reviewedCount > 0 ? "#fbbf24" : "#34d399" },
          ].map((s, i) => (
            <div key={i} style={{
              padding: "16px 18px", borderRadius: 12,
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", marginBottom: 6 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
          marginBottom: 24, overflow: "hidden",
        }}>
          <div style={{
            height: "100%", borderRadius: 2,
            background: "linear-gradient(90deg, #9382dc, #34d399)",
            width: `${progress}%`,
            transition: "width 0.5s ease",
          }} />
        </div>

        {/* Controls */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 20, flexWrap: "wrap", gap: 12,
        }}>
          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3 }}>
            {[
              { key: "all", label: `All (${entries.length})` },
              { key: "unreviewed", label: `To Review (${entries.length - reviewedCount})` },
              { key: "reviewed", label: `Done (${reviewedCount})` },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                style={{
                  padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  border: "none",
                  background: filter === t.key ? "rgba(255,255,255,0.08)" : "transparent",
                  color: filter === t.key ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.35)",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Load file */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: "1px dashed rgba(255,255,255,0.15)",
              background: "transparent",
              color: "rgba(255,255,255,0.4)",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {loadingFile ? "Loading..." : "↑ Load Log File"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />
        </div>

        {/* Change Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: 60, textAlign: "center",
              color: "rgba(255,255,255,0.25)", fontSize: 14,
            }}>
              {entries.length === 0
                ? "No changes loaded. Load a log file from the tracker script."
                : "All caught up! No changes match this filter."}
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

        {/* How it works */}
        <div style={{
          marginTop: 40, padding: 24,
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 14,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>
            HOW TO USE THIS
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.8, color: "rgba(255,255,255,0.45)" }}>
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>Step 1:</strong> Run the PowerShell tracker script in the background while you code with Claude Code.
            <br />
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>Step 2:</strong> It auto-captures every commit into daily JSON log files.
            <br />
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>Step 3:</strong> At end of day, load the JSON file here using the "Load Log File" button.
            <br />
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>Step 4:</strong> Expand each change, read the diff, and hit "Explain This Change" for an AI breakdown.
            <br />
            <strong style={{ color: "rgba(255,255,255,0.65)" }}>Step 5:</strong> Mark changes as reviewed and add your own notes as you learn.
          </div>
        </div>
      </div>
    </div>
  );
}
