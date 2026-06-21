/** Parses JSON from LLM output, stripping optional markdown code fences. */
export function parseJsonContent(raw: string): unknown {
  let content = raw.trim();

  const fenceMatch = content.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  }

  return JSON.parse(content);
}
