import * as cheerio from "cheerio";

export interface PageData {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h2s: string[];
  bodyText: string;
  wordCount: number;
  statusCode: number;
}

export async function extractPage(url: string): Promise<PageData | null> {
  let html: string;
  let statusCode: number;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MyLinksBot/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    statusCode = res.status;
    if (!res.ok) {
      return {
        title: null,
        metaDescription: null,
        h1: null,
        h2s: [],
        bodyText: "",
        wordCount: 0,
        statusCode,
      };
    }
    html = await res.text();
  } catch {
    return null;
  }

  const $ = cheerio.load(html);

  // Remove noise
  $("script, style, nav, footer, header, aside, [aria-hidden='true']").remove();

  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $("meta[name='description']").attr("content")?.trim() || null;
  const h1 = $("h1").first().text().trim() || null;
  const h2s = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const bodyText = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  return { title, metaDescription, h1, h2s, bodyText, wordCount, statusCode };
}
