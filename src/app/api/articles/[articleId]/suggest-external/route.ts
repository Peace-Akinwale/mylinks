import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getExternalSuggestions } from "@/lib/gemini";

export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ articleId: string }> }
) {
  const { articleId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });

  let rawSuggestions;
  try {
    rawSuggestions = await getExternalSuggestions(article.content_text);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gemini call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Delete existing external suggestions for this article
  const serviceClient = await createServiceClient();
  await serviceClient
    .from("suggestions")
    .delete()
    .eq("article_id", articleId)
    .eq("link_type", "external");

  const toInsert = rawSuggestions.map((s, i) => ({
    article_id: articleId,
    target_page_id: null,
    target_url: s.target_url,
    anchor_text: s.anchor_text,
    anchor_refinement: s.anchor_refinement ?? null,
    page_type: null,
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
    link_type: "external" as const,
  }));

  const { data: inserted, error } = await serviceClient
    .from("suggestions")
    .insert(toInsert)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ suggestions: inserted }, { status: 201 });
}
