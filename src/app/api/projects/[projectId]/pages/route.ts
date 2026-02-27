import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PageType } from "@/lib/types/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "50");
  const pageType = searchParams.get("page_type");
  const offset = (page - 1) * limit;

  let query = supabase
    .from("pages")
    .select("*", { count: "exact" })
    .eq("project_id", projectId)
    .order("priority", { ascending: false })
    .range(offset, offset + limit - 1);

  if (pageType) query = query.eq("page_type", pageType as PageType);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, limit });
}
