export function normalizeDomain(input: string): string {
  let d = input.trim();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.replace(/\/+$/, "");
  return d;
}

export function extractGoogleDocId(input: string): string {
  const match = input.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  return input.trim();
}
