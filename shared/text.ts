export function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();
}

export function includesFold(haystack: string, needle: string): boolean {
  const query = fold(needle.trim());
  if (!query) return true;
  return fold(haystack).includes(query);
}

export function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function normalizeList(values: string[], limit: number, itemLimit = 120): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const clean = value.trim().replace(/\s+/g, " ").slice(0, itemLimit);
    const key = fold(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

export function slugify(value: string): string {
  const slug = fold(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "ata";
}

export function previewText(value: string, max = 140): string {
  const line = value.trim().split(/\n/)[0] ?? "";
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}
