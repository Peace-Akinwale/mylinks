import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refreshAccessToken } from "@/lib/google-auth";
import { extractDocContent, buildBatchUpdateRequests } from "@/lib/google-docs";

async function getValidAccessToken(userId: string): Promise<string> {
  const serviceClient = await createServiceClient();
  const { data: tokenRow } = await serviceClient
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenRow) throw new Error("Google account not connected");

  if (new Date(tokenRow.expires_at).getTime() > Date.now() + 60_000) {
    return tokenRow.access_token;
  }

  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await serviceClient
    .from("google_tokens")
    .update({ access_token: refreshed.access_token, expires_at: newExpiry })
    .eq("user_id", userId);

  return refreshed.access_token;
}

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
    .select("*")
    .eq("id", articleId)
    .single();

  if (!article) return NextResponse.json({ error: "Article not found" }, { status: 404 });
  if (!article.google_doc_id) {
    return NextResponse.json({ error: "Article has no Google Doc" }, { status: 400 });
  }

  // Fetch approved suggestions
  const { data: suggestions } = await supabase
    .from("suggestions")
    .select("*")
    .eq("article_id", articleId)
    .eq("status", "approved");

  if (!suggestions || suggestions.length === 0) {
    return NextResponse.json({ error: "No approved suggestions to apply" }, { status: 400 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth error";
    return NextResponse.json({ error: message }, { status: 401 });
  }

  // Fetch live doc to get current indices
  const docRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${article.google_doc_id}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!docRes.ok) {
    return NextResponse.json(
      { error: `Failed to fetch Google Doc: ${docRes.status}` },
      { status: 500 }
    );
  }

  const doc = await docRes.json();
  const { charToDocIndex } = extractDocContent(doc);

  const patches = suggestions
    .filter((s) => s.char_start >= 0 && s.char_end > s.char_start)
    .map((s) => ({
      char_start: s.char_start,
      char_end: s.char_end,
      url: s.target_url,
    }));

  const requests = buildBatchUpdateRequests(patches, charToDocIndex);

  if (requests.length === 0) {
    return NextResponse.json({ error: "Could not map suggestions to doc positions" }, { status: 400 });
  }

  // Apply via batchUpdate
  const updateRes = await fetch(
    `https://docs.googleapis.com/v1/documents/${article.google_doc_id}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    return NextResponse.json(
      { error: `Google Docs batchUpdate failed: ${errText}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ applied: requests.length });
}
