"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CrawlEvent {
  type: "status" | "total" | "progress" | "done" | "error";
  message?: string;
  total?: number;
  crawled?: number;
  failed?: number;
  url?: string;
}

export default function CrawlButton({ projectId }: { projectId: string }) {
  const [crawling, setCrawling] = useState(false);
  const [progress, setProgress] = useState<{ crawled: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function startCrawl() {
    setCrawling(true);
    setError(null);
    setProgress(null);

    const res = await fetch(`/api/projects/${projectId}/crawl`, {
      method: "POST",
    });

    if (!res.ok || !res.body) {
      setError("Failed to start crawl");
      setCrawling(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event: CrawlEvent = JSON.parse(line.slice(6));
            if (event.type === "total") {
              setProgress({ crawled: 0, total: event.total! });
            } else if (event.type === "progress") {
              setProgress((p) => ({ crawled: event.crawled!, total: p?.total ?? 0 }));
            } else if (event.type === "done") {
              setCrawling(false);
              router.refresh();
            } else if (event.type === "error") {
              setError(event.message ?? "Crawl failed");
              setCrawling(false);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      setError("Connection lost during crawl");
    }

    setCrawling(false);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={startCrawl}
        disabled={crawling}
        className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {crawling ? "Crawling..." : "Crawl sitemap"}
      </button>

      {crawling && progress && (
        <p className="text-xs text-gray-500">
          {progress.crawled} / {progress.total} pages
        </p>
      )}

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
