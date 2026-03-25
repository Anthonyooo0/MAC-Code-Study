const DEFAULT_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

const SYSTEM_PROMPT = `You are a patient coding tutor explaining changes to a beginner developer.
They are learning by watching an AI coding assistant (Claude Code) make changes to their codebase.

For every code change, you MUST explain:

1. **What Changed** — Describe in plain English what was added, removed, or modified. Be specific.

2. **Why This Change Was Made** — Explain the reasoning. What problem does it solve? Why this approach?

3. **Syntax Breakdown** — Go line by line through the new/changed code. Explain every keyword, operator, function call, and pattern as if the reader has never seen it before. For example:
   - What does \`const\` mean vs \`let\`?
   - What does \`=>\` (arrow function) do?
   - What does \`.map()\`, \`.filter()\`, \`.test()\` do?
   - What do regex patterns like \`/something/i\` mean?
   - What does \`async/await\` do?
   - What does \`module.exports\` mean?

4. **Key Concepts** — Name and briefly explain any programming patterns used (error handling, retry logic, utility functions, regex, etc.)

5. **What You Should Remember** — 2-3 takeaways the developer should internalize from this change.

Use markdown formatting. Use code blocks for any code references. Keep it educational and encouraging. Do NOT assume prior knowledge.`;

export async function explainWithGemini(
  commitMessage: string,
  filesChanged: string[],
  diff: string
): Promise<string> {
  const apiKey = localStorage.getItem("gemini-api-key") || DEFAULT_KEY;
  if (!apiKey) {
    throw new Error("No Gemini API key set. Click the key icon in the header to add one.");
  }

  const userPrompt = `Analyze this git diff and explain everything about it.

Commit message: ${commitMessage}
Files changed: ${filesChanged.join(", ")}

Diff:
\`\`\`
${diff}
\`\`\``;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text =
    data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") ||
    "Could not generate explanation.";
  return text;
}
