import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSuggestions } from "@/lib/gemini";
import type { InventoryPage } from "@/lib/gemini";

export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch article
  const { data: article } = await supabase
    .from("articles")
    .select("*, project:projects(id, owner_id)")
    .eq("id", articleId)
    .single();

  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  const projectId = article.project_id;

  // Fetch page inventory
  const { data: pages } = await supabase
    .from("pages")
    .select("url, title, h1, meta_description, page_type, priority")
    .eq("project_id", projectId)
    .order("priority", { ascending: false })
    .limit(300);

  if (!pages || pages.length === 0) {
    return NextResponse.json(
      { error: "No pages in inventory. Run a crawl first." },
      { status: 400 }
    );
  }

  // Call Gemini
  let rawSuggestions;
  try {
    rawSuggestions = await getSuggestions(
      article.content_text,
      pages as InventoryPage[]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Resolve target_page_id for each suggestion
  const urlToPageId = new Map(pages.map((p) => [p.url, (p as { id?: string }).id]));

  // Build page url → page record map for type lookup
  const pageMap = new Map(pages.map((p) => [p.url, p]));

  // Delete existing suggestions for this article before inserting new ones
  const serviceClient = await createServiceClient();
  await serviceClient.from("suggestions").delete().eq("article_id", articleId);

  const toInsert = rawSuggestions.map((s, i) => {
    const targetPage = pageMap.get(s.target_url);
    return {
      article_id: articleId,
      target_page_id: urlToPageId.get(s.target_url) ?? null,
      target_url: s.target_url,
      anchor_text: s.anchor_text,
      anchor_refinement: s.anchor_refinement ?? null,
      page_type: targetPage?.page_type ?? null,
      relevance_score: s.relevance_score,
      confidence: s.confidence,
      paragraph_index: s.paragraph_index,
      sentence_index: s.sentence_index,
      char_start: s.char_start,
      char_end: s.char_end,
      justification: s.justification,
      duplicate_flag: false,
      over_optimization_flag: false,
      status: "pending" as const,
      sort_order: i,
    };
  });

  const { data: inserted, error } = await serviceClient
    .from("suggestions")
    .insert(toInsert)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ suggestions: inserted }, { status: 201 });
}
