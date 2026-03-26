import Prism from "prismjs";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-css";
import "prismjs/components/prism-json";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-python";

interface DiffLine {
  text: string;
  type: "added" | "removed" | "header" | "file" | "context";
}

function classifyLine(line: string): DiffLine["type"] {
  if (line.startsWith("diff --git")) return "file";
  if (line.startsWith("index ")) return "file";
  if (line.startsWith("--- ")) return "file";
  if (line.startsWith("+++ ")) return "file";
  if (line.startsWith("@@")) return "header";
  if (line.startsWith("+")) return "added";
  if (line.startsWith("-")) return "removed";
  return "context";
}

function parseDiff(raw: string): DiffLine[] {
  const lines = raw.split("\n");

  // If proper newlines exist, use them directly
  if (lines.length > 5) {
    return lines
      .filter((l) => l.length > 0)
      .map((line) => ({ text: line, type: classifyLine(line) }));
  }

  // Fallback: reconstruct from space-joined blob
  const reconstructed = raw
    .replace(/ (?=diff --git )/g, "\n")
    .replace(/ (?=index [0-9a-f]{6,})/g, "\n")
    .replace(/ (?=--- [ab]\/)/g, "\n")
    .replace(/ (?=\+\+\+ [ab]\/)/g, "\n")
    .replace(/ (?=@@ )/g, "\n");

  return reconstructed
    .split("\n")
    .filter((l) => l.length > 0)
    .map((line) => ({ text: line.trimEnd(), type: classifyLine(line) }));
}

function detectLanguage(diff: string): string {
  const fileMatch = diff.match(/diff --git a\/.*?\.(\w+)/);
  if (!fileMatch) return "javascript";
  const ext = fileMatch[1].toLowerCase();
  const map: Record<string, string> = {
    js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    css: "css", json: "json", sh: "bash", bash: "bash",
    sql: "sql", py: "python",
  };
  return map[ext] || "javascript";
}

function highlightCode(code: string, lang: string): string {
  const grammar = Prism.languages[lang];
  if (!grammar) return escapeHtml(code);
  return Prism.highlight(code, grammar, lang);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function DiffViewer({ diff }: { diff: string }) {
  const allLines = parseDiff(diff);
  const lang = detectLanguage(diff);

  // Group into file sections
  const sections: { file: string; chunks: DiffLine[][] }[] = [];
  let currentFile = "";
  let currentChunk: DiffLine[] = [];

  for (const line of allLines) {
    if (line.type === "file") {
      if (line.text.startsWith("diff --git")) {
        // Extract filename
        const match = line.text.match(/b\/(.+)$/);
        if (sections.length > 0 || currentChunk.length > 0) {
          if (currentChunk.length > 0) {
            if (!sections.length || sections[sections.length - 1].file !== currentFile) {
              sections.push({ file: currentFile, chunks: [currentChunk] });
            } else {
              sections[sections.length - 1].chunks.push(currentChunk);
            }
          }
          currentChunk = [];
        }
        currentFile = match ? match[1] : line.text;
      }
      continue; // Skip file header lines (diff --git, index, ---, +++)
    }
    if (line.type === "header") {
      if (currentChunk.length > 0) {
        const existing = sections.find((s) => s.file === currentFile);
        if (existing) {
          existing.chunks.push(currentChunk);
        } else {
          sections.push({ file: currentFile, chunks: [currentChunk] });
        }
        currentChunk = [];
      }
      continue; // Skip @@ header lines
    }
    currentChunk.push(line);
  }

  // Push last chunk
  if (currentChunk.length > 0) {
    const existing = sections.find((s) => s.file === currentFile);
    if (existing) {
      existing.chunks.push(currentChunk);
    } else {
      sections.push({ file: currentFile, chunks: [currentChunk] });
    }
  }

  return (
    <div className="space-y-3">
      {sections.map((section, si) => (
        <div key={si} className="rounded-lg border border-white/10 overflow-hidden">
          {/* File name header */}
          <div className="px-4 py-2 bg-white/[0.03] border-b border-white/[0.06] text-[11px] font-mono text-white/40">
            Modified: <span className="text-white/60">{section.file}</span>
          </div>

          {/* Only show added/removed lines, like VS Code inline diff */}
          <div className="font-mono text-xs leading-relaxed">
            {section.chunks.map((chunk, ci) => {
              // Filter to only show changed lines (added/removed)
              const changes = chunk.filter(
                (l) => l.type === "added" || l.type === "removed"
              );
              if (changes.length === 0) return null;

              return (
                <div key={ci}>
                  {ci > 0 && (
                    <div className="px-4 py-1 text-[10px] text-white/15 border-t border-white/[0.04]">
                      ...
                    </div>
                  )}
                  {changes.map((line, li) => {
                    const prefix = line.text[0];
                    const rawCode = line.text.slice(1).trim();
                    // Strip JSX/HTML tags and className noise to show only meaningful content
                    const cleaned = rawCode
                      .replace(/<[^>]+>/g, " ")   // remove HTML/JSX tags
                      .replace(/className="[^"]*"/g, "") // remove className attrs
                      .replace(/\s{2,}/g, " ")     // collapse whitespace
                      .trim();
                    // Use the cleaned version if it's shorter and meaningful, otherwise show raw
                    const display = cleaned.length > 0 && cleaned.length < rawCode.length * 0.7
                      ? cleaned
                      : rawCode;
                    const highlighted = highlightCode(display, lang);

                    return (
                      <div
                        key={`${ci}-${li}`}
                        className={`px-4 py-1.5 diff-${line.type}`}
                      >
                        <span className="diff-prefix">{prefix}</span>
                        <span dangerouslySetInnerHTML={{ __html: highlighted }} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
