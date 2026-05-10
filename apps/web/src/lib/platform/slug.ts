const SLUG_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function deriveSlug(short: string): string {
  return short
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 16);
}

export function deriveShort(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 6);
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= 3 && slug.length <= 16 && SLUG_RE.test(slug);
}
