export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesSearch(
  query: string,
  ...fields: (string | number | null | undefined)[]
): boolean {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  return fields.some((field) => {
    if (field == null) return false;
    return String(field).toLowerCase().includes(q);
  });
}
