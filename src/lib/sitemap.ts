import { parseStringPromise } from "xml2js";

export async function parseSitemap(url: string): Promise<string[]> {
  const urls: string[] = [];
  await fetchSitemap(url, urls, new Set());
  return urls;
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
    text = await res.text();
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
    const childSitemaps = index.sitemap ?? [];
    const childUrls = childSitemaps
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
