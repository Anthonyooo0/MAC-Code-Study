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

function parseDiff(raw: string): DiffLine[] {
  return raw.split("\n").map((line) => {
    let type: DiffLine["type"] = "context";
    if (line.startsWith("+") && !line.startsWith("+++")) type = "added";
    else if (line.startsWith("-") && !line.startsWith("---")) type = "removed";
    else if (line.startsWith("@@")) type = "header";
    else if (line.startsWith("diff ")) type = "file";
    return { text: line, type };
  });
}

function detectLanguage(diff: string): string {
  const fileMatch = diff.match(/diff --git a\/.*?\.(\w+)/);
  if (!fileMatch) return "javascript";
  const ext = fileMatch[1].toLowerCase();
  const map: Record<string, string> = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    css: "css",
    json: "json",
    sh: "bash",
    bash: "bash",
    sql: "sql",
    py: "python",
  };
  return map[ext] || "javascript";
}

function highlightCode(code: string, lang: string): string {
  const grammar = Prism.languages[lang];
  if (!grammar) return escapeHtml(code);
  return Prism.highlight(code, grammar, lang);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function DiffViewer({ diff }: { diff: string }) {
  const lines = parseDiff(diff);
  const lang = detectLanguage(diff);

  return (
    <div className="rounded-lg border border-white/10 overflow-hidden font-mono text-xs leading-relaxed">
      {lines.map((line, i) => {
        // For code lines (added/removed/context), strip the +/- prefix, highlight, then re-add prefix
        const isCode =
          line.type === "added" ||
          line.type === "removed" ||
          line.type === "context";

        let content: string;
        if (isCode && line.text.length > 0) {
          const prefix = line.type === "context" ? " " : line.text[0];
          const code = line.text.slice(1);
          const highlighted = highlightCode(code, lang);
          content = `<span class="diff-prefix">${escapeHtml(prefix)}</span>${highlighted}`;
        } else {
          content = escapeHtml(line.text || " ");
        }

        return (
          <div
            key={i}
            className={`px-4 py-0.5 whitespace-pre-wrap break-all diff-${line.type}`}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        );
      })}
    </div>
  );
}
