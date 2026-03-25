import { useState, useEffect, useRef } from "react";
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
import { explainWithGemini } from "../gemini";
import type { ChangeEntry } from "../types";

interface Props {
  entry: ChangeEntry;
  onExplain: (id: string, explanation: string) => void;
}

function renderMarkdown(text: string): string {
  return (
    text
      // code blocks — preserve language tag for Prism
      .replace(
        /```(\w*)\n([\s\S]*?)```/g,
        (_match, lang, code) =>
          `<pre><code class="language-${lang || "javascript"}">${escapeHtml(code)}</code></pre>`
      )
      // inline code
      .replace(/`([^`]+)`/g, '<code class="language-javascript">$1</code>')
      // bold
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      // italic
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      // h3
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      // h2
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      // h1
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      // unordered list items
      .replace(/^- (.+)$/gm, "<li>$1</li>")
      // ordered list items
      .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
      // hr
      .replace(/^---$/gm, "<hr/>")
      // blockquote
      .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
      // paragraphs
      .replace(/\n\n/g, "</p><p>")
      // single newlines
      .replace(/\n/g, "<br/>")
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function HighlightedContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      // Highlight all <code> blocks inside
      ref.current.querySelectorAll("pre code, code").forEach((el) => {
        Prism.highlightElement(el);
      });
    }
  }, [html]);

  return (
    <div
      ref={ref}
      className="ai-explanation px-5 py-4 text-sm text-white/70 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function AiExplanation({ entry, onExplain }: Props) {
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(
    entry.aiExplanation || null
  );
  const [error, setError] = useState<string | null>(null);

  async function handleExplain() {
    setLoading(true);
    setError(null);
    try {
      const text = await explainWithGemini(
        entry.commitMessage,
        entry.filesChanged,
        entry.diff
      );
      setExplanation(text);
      onExplain(entry.id, text);
    } catch (err: any) {
      setError(err.message || "Failed to get explanation.");
    }
    setLoading(false);
  }

  if (explanation) {
    return (
      <div className="mt-4 fade-in">
        <div className="border border-white/10 rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-white/50">
              Gemini Explanation
            </span>
            <button
              onClick={handleExplain}
              className="text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              {loading ? "Regenerating..." : "Regenerate"}
            </button>
          </div>
          <HighlightedContent html={renderMarkdown(explanation)} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      {error && <p className="text-xs text-white/40 mb-2">{error}</p>}
      <button
        onClick={handleExplain}
        disabled={loading}
        className="px-5 py-2.5 rounded-lg border border-white/15 text-sm font-semibold text-white/60 hover:text-white hover:border-white/30 transition-all disabled:opacity-40 disabled:cursor-wait"
      >
        {loading ? "Analyzing with Gemini..." : "Explain This Change"}
      </button>
    </div>
  );
}
