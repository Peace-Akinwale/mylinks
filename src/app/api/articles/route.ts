import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { project_id, title, source, content_text, google_doc_id } = body;

  if (!project_id || !title || !content_text) {
    return NextResponse.json(
      { error: "project_id, title, and content_text are required" },
      { status: 400 }
    );
  }

  // Verify project belongs to user
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", project_id)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const wordCount = content_text.trim().split(/\s+/).filter(Boolean).length;

  const { data, error } = await supabase
    .from("articles")
    .insert({
      project_id,
      title,
      source: source ?? "paste",
      content_text,
      google_doc_id: google_doc_id ?? null,
      word_count: wordCount,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data, { status: 201 });
}
