import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { parseSitemap } from "@/lib/sitemap";
import { extractPage } from "@/lib/extract";
import { inferPageType } from "@/lib/page-type";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Verify project ownership
  const { data: project } = await supabase
    .from("projects")
    .select("id, sitemap_url, domain")
    .eq("id", projectId)
    .single();

  if (!project) return new Response("Not found", { status: 404 });

  const sitemapUrl =
    project.sitemap_url || `https://${project.domain}/sitemap.xml`;

  const serviceClient = await createServiceClient();

  // Create crawl log
  const { data: crawlLog } = await serviceClient
    .from("crawl_logs")
    .insert({ project_id: projectId, status: "running" })
    .select()
    .single();

  if (!crawlLog) {
    return new Response("Failed to create crawl log", { status: 500 });
  }

  const encoder = new TextEncoder();

  function send(controller: ReadableStreamDefaultController, event: object) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        send(controller, { type: "status", message: "Fetching sitemap..." });

        const urls = await parseSitemap(sitemapUrl);

        if (urls.length === 0) {
          send(controller, { type: "error", message: "No URLs found in sitemap" });
          await serviceClient
            .from("crawl_logs")
            .update({ status: "failed", error_message: "No URLs found", completed_at: new Date().toISOString() })
            .eq("id", crawlLog.id);
          controller.close();
          return;
        }

        send(controller, { type: "total", total: urls.length });

        await serviceClient
          .from("crawl_logs")
          .update({ total_urls: urls.length })
          .eq("id", crawlLog.id);

        let crawled = 0;
        let failed = 0;
        const BATCH = 10;

        for (let i = 0; i < urls.length; i += BATCH) {
          const batch = urls.slice(i, i + BATCH);

          await Promise.all(
            batch.map(async (url) => {
              const pageData = await extractPage(url);
              if (!pageData) {
                failed++;
                return;
              }

              const { pageType, priority } = inferPageType(
                url,
                pageData.title,
                pageData.wordCount
              );

              await serviceClient.from("pages").upsert({
                project_id: projectId,
                url,
                title: pageData.title,
                meta_description: pageData.metaDescription,
                h1: pageData.h1,
                h2s: pageData.h2s,
                page_type: pageType,
                priority,
                word_count: pageData.wordCount,
                status_code: pageData.statusCode,
                last_crawled_at: new Date().toISOString(),
              });

              crawled++;
              send(controller, { type: "progress", crawled, failed, url });
            })
          );

          await serviceClient
            .from("crawl_logs")
            .update({ crawled_urls: crawled, failed_urls: failed })
            .eq("id", crawlLog.id);
        }

        await serviceClient
          .from("crawl_logs")
          .update({
            status: "completed",
            crawled_urls: crawled,
            failed_urls: failed,
            completed_at: new Date().toISOString(),
          })
          .eq("id", crawlLog.id);

        send(controller, { type: "done", crawled, failed });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        send(controller, { type: "error", message });
        await serviceClient
          .from("crawl_logs")
          .update({ status: "failed", error_message: message, completed_at: new Date().toISOString() })
          .eq("id", crawlLog.id);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
