"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewArticlePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [tab, setTab] = useState<"paste" | "google_doc">("paste");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [docId, setDocId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    let contentText = content;

    // If Google Doc, fetch doc content first
    if (tab === "google_doc") {
      const docRes = await fetch(`/api/google/docs/${encodeURIComponent(docId)}`);
      if (!docRes.ok) {
        const d = await docRes.json();
        setError(d.error ?? "Failed to fetch Google Doc");
        setLoading(false);
        return;
      }
      const docData = await docRes.json();
      contentText = docData.text;
    }

    const res = await fetch("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        title,
        source: tab,
        content_text: contentText,
        google_doc_id: tab === "google_doc" ? docId : null,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Failed to create article");
      setLoading(false);
      return;
    }

    router.push(`/projects/${projectId}/articles/${data.id}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          Project
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">New article</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">New article</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Article title
            </label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="How to improve your SEO..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Source tabs */}
          <div>
            <div className="flex border-b border-gray-200 mb-4">
              <button
                type="button"
                onClick={() => setTab("paste")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === "paste"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Paste text
              </button>
              <button
                type="button"
                onClick={() => setTab("google_doc")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === "google_doc"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Google Doc
              </button>
            </div>

            {tab === "paste" ? (
              <textarea
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your article content here..."
                rows={16}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
              />
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Paste the Google Doc URL or document ID.
                </p>
                <input
                  required={tab === "google_doc"}
                  value={docId}
                  onChange={(e) => setDocId(e.target.value)}
                  placeholder="https://docs.google.com/document/d/... or document ID"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400">
                  Make sure you&apos;ve connected Google in settings and the doc is
                  shared with your account.
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Link
              href={`/projects/${projectId}`}
              className="flex-1 py-2 text-center border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create article"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
