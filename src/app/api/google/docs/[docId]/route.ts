import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { refreshAccessToken } from "@/lib/google-auth";
import { extractDocContent, extractDocIdFromUrl } from "@/lib/google-docs";

async function getValidAccessToken(userId: string): Promise<string> {
  const serviceClient = await createServiceClient();
  const { data: tokenRow } = await serviceClient
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokenRow) throw new Error("Google account not connected");

  // Check expiry with 60s buffer
  if (new Date(tokenRow.expires_at).getTime() > Date.now() + 60_000) {
    return tokenRow.access_token;
  }

  // Refresh
  const refreshed = await refreshAccessToken(tokenRow.refresh_token);
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

  await serviceClient
    .from("google_tokens")
    .update({ access_token: refreshed.access_token, expires_at: newExpiry })
    .eq("user_id", userId);

  return refreshed.access_token;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId: rawDocId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[google-docs] No Supabase user in request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await getValidAccessToken(user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Auth error";
    console.error("[google-docs] Token error for user", user.id, ":", message);
    return NextResponse.json({ error: message }, { status: 401 });
  }

  const docId = extractDocIdFromUrl(decodeURIComponent(rawDocId));

  const res = await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: `Google Docs API error: ${res.status}` },
      { status: res.status }
    );
  }

  const doc = await res.json();
  const { text } = extractDocContent(doc);

  return NextResponse.json({ text, docId });
}
