import { parseStringPromise } from "xml2js";

/** Parse a single XML sitemap URL, recursing into sitemap indexes. */
export async function parseSitemap(url: string): Promise<string[]> {
  const urls: string[] = [];
  await fetchSitemap(url, urls, new Set());
  return urls;
}

/**
 * Auto-discover the sitemap for a domain and return all page URLs.
 * Strategy:
 *   1. User-supplied override URL (if any)
 *   2. Sitemap directives found in robots.txt
 *   3. Common well-known sitemap paths
 * Returns the URLs found and which sitemap URL worked.
 */
export async function discoverAndParseSitemap(
  domain: string,
  storedSitemapUrl?: string | null
): Promise<{ urls: string[]; foundAt: string | null }> {
  const candidates: string[] = [];

  // 1. User-specified URL takes priority
  if (storedSitemapUrl) candidates.push(storedSitemapUrl);

  // 2. Discover from robots.txt
  const robotsSitemaps = await getSitemapUrlsFromRobots(domain);
  for (const u of robotsSitemaps) {
    if (!candidates.includes(u)) candidates.push(u);
  }

  // 3. Well-known fallback paths (with and without www)
  const bases = [`https://${domain}`, `https://www.${domain}`];
  const paths = [
    "/sitemap.xml",
    "/sitemap_index.xml",
    "/wp-sitemap.xml",       // WordPress native
    "/sitemap/xml",          // Some custom setups
    "/news-sitemap.xml",
  ];
  for (const base of bases) {
    for (const path of paths) {
      const url = `${base}${path}`;
      if (!candidates.includes(url)) candidates.push(url);
    }
  }

  // Try each candidate in order, stop on first success
  for (const candidate of candidates) {
    const urls = await parseSitemap(candidate);
    if (urls.length > 0) return { urls, foundAt: candidate };
  }

  return { urls: [], foundAt: null };
}

/** Extract Sitemap: directives from robots.txt */
async function getSitemapUrlsFromRobots(domain: string): Promise<string[]> {
  const found: string[] = [];
  for (const base of [`https://${domain}`, `https://www.${domain}`]) {
    try {
      const res = await fetch(`${base}/robots.txt`, {
        headers: { "User-Agent": "MyLinksBot/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      const matches = text.match(/^Sitemap:\s*(.+)$/gim) ?? [];
      for (const line of matches) {
        const url = line.replace(/^Sitemap:\s*/i, "").trim();
        if (url && !found.includes(url)) found.push(url);
      }
      if (found.length > 0) break; // Got sitemaps from first robots.txt, stop
    } catch {
      // unreachable host — try next
    }
  }
  return found;
}

async function fetchSitemap(
  url: string,
  collected: string[],
  visited: Set<string>
): Promise<void> {
  if (visited.has(url)) return;
  visited.add(url);

  let text: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MyLinksBot/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return;
    const contentType = res.headers.get("content-type") ?? "";
    // Skip HTML pages — they are human-readable sitemaps, not XML
    if (contentType.includes("text/html")) return;
    text = await res.text();
    // Guard against HTML responses without a proper content-type header
    const trimmed = text.trimStart();
    if (trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<html")) return;
  } catch {
    return;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = await parseStringPromise(text, { explicitArray: true });
  } catch {
    return;
  }

  // Sitemap index — recurse into child sitemaps
  if (parsed.sitemapindex) {
    const index = parsed.sitemapindex as {
      sitemap?: Array<{ loc?: string[] }>;
    };
    const childUrls = (index.sitemap ?? [])
      .map((s) => s.loc?.[0])
      .filter((u): u is string => !!u);

    await Promise.all(
      childUrls.map((childUrl) => fetchSitemap(childUrl, collected, visited))
    );
    return;
  }

  // Standard urlset
  if (parsed.urlset) {
    const urlset = parsed.urlset as { url?: Array<{ loc?: string[] }> };
    const pageUrls = (urlset.url ?? [])
      .map((u) => u.loc?.[0])
      .filter((u): u is string => !!u);
    collected.push(...pageUrls);
  }
}
