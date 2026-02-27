import type { PageType } from "@/lib/types/database";

interface PageTypeResult {
  pageType: PageType;
  priority: number;
}

export function inferPageType(
  url: string,
  title: string | null,
  wordCount: number
): PageTypeResult {
  const pathname = new URL(url).pathname.toLowerCase();
  const segments = pathname.split("/").filter(Boolean);

  // Homepage
  if (pathname === "/" || pathname === "") {
    return { pageType: "homepage", priority: 100 };
  }

  // Contact
  if (/contact|reach|get-in-touch/.test(pathname)) {
    return { pageType: "contact", priority: 20 };
  }

  // About
  if (/about|team|story|mission|who-we-are/.test(pathname)) {
    return { pageType: "about", priority: 30 };
  }

  // Blog post — has date or /blog/ with deep path
  if (
    /\d{4}\/\d{2}\/\d{2}/.test(pathname) ||
    (/\/(blog|post|article|news)\//.test(pathname) && segments.length >= 2)
  ) {
    const priority = wordCount > 800 ? 80 : wordCount > 300 ? 65 : 50;
    return { pageType: "blog_post", priority };
  }

  // Category — short path under blog/category/tag
  if (/\/(blog|category|tag|topics?)\/?$/.test(pathname)) {
    return { pageType: "category", priority: 60 };
  }

  // Product
  if (/\/(product|shop|store|item)\//.test(pathname)) {
    return { pageType: "product", priority: 70 };
  }

  // Service
  if (/\/(service|solution|feature|offering)/.test(pathname)) {
    return { pageType: "service", priority: 75 };
  }

  // Landing — short single-segment paths
  if (segments.length === 1 && wordCount > 200) {
    return { pageType: "landing", priority: 70 };
  }

  // Default — score by depth and word count
  const depthPenalty = Math.min(segments.length * 5, 30);
  const contentBonus = wordCount > 500 ? 10 : 0;
  return { pageType: "other", priority: Math.max(40 - depthPenalty + contentBonus, 10) };
}
