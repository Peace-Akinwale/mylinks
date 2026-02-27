"use client";

import { useState, useCallback, useMemo } from "react";
import { marked } from "marked";
import type { Database } from "@/lib/types/database";

type Article = Database["public"]["Tables"]["articles"]["Row"];
type Suggestion = Database["public"]["Tables"]["suggestions"]["Row"];

interface Props {
  article: Article;
  initialSuggestions: Suggestion[];
  projectId: string;
}

export default function SuggestionReview({
  article,
  initialSuggestions,
  projectId,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>(initialSuggestions);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function generateSuggestions() {
    setGenerating(true);
    setError(null);
    const res = await fetch(`/api/articles/${article.id}/suggest`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to generate suggestions");
    } else {
      setSuggestions(data.suggestions);
      showToast(`${data.suggestions.length} suggestions generated`);
    }
    setGenerating(false);
  }

  const updateStatus = useCallback(
    async (id: string, status: "approved" | "rejected" | "pending") => {
      const previous = suggestions;
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status } : s))
      );
      const res = await fetch(`/api/articles/${article.id}/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        setSuggestions(previous);
        showToast("Failed to update suggestion — reverted");
      }
    },
    [article.id, suggestions]
  );

  async function applyToGoogleDoc() {
    setApplying(true);
    setError(null);
    const res = await fetch(`/api/articles/${article.id}/apply`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to apply links");
    } else {
      showToast(`${data.applied} links applied to Google Doc`);
    }
    setApplying(false);
  }

  const approvedCount = suggestions.filter((s) => s.status === "approved").length;
  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  // Build highlighted draft
  const highlightedDraft = useMemo(
    () => buildHighlightedDraft(article.content_text, suggestions),
    [article.content_text, suggestions]
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>
            <strong className="text-gray-900">{suggestions.length}</strong> suggestions
          </span>
          <span className="text-green-600">
            <strong>{approvedCount}</strong> approved
          </span>
          <span className="text-yellow-600">
            <strong>{pendingCount}</strong> pending
          </span>
        </div>
        <div className="flex gap-3">
          {article.source === "google_doc" && article.google_doc_id && (
            <button
              onClick={applyToGoogleDoc}
              disabled={applying || approvedCount === 0}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {applying ? "Applying..." : `Apply ${approvedCount} to Google Doc`}
            </button>
          )}
          <button
            onClick={generateSuggestions}
            disabled={generating}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? "Generating..." : suggestions.length > 0 ? "Regenerate" : "Generate suggestions"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Draft */}
        <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{article.title}</h2>
          <div
            className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedDraft }}
          />
        </div>

        {/* Right: Suggestions */}
        <div className="w-96 overflow-y-auto p-4 space-y-3 bg-gray-50">
          {suggestions.length === 0 ? (
            <div className="text-center py-16 text-sm text-gray-400">
              {generating
                ? "Analyzing your article..."
                : "No suggestions yet. Click \"Generate suggestions\" to start."}
            </div>
          ) : (
            suggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onStatusChange={updateStatus}
              />
            ))
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion: s,
  onStatusChange,
}: {
  suggestion: Suggestion;
  onStatusChange: (id: string, status: "approved" | "rejected" | "pending") => void;
}) {
  const statusStyles = {
    approved: "border-green-300 bg-green-50",
    rejected: "border-gray-200 bg-gray-100 opacity-60",
    pending: "border-yellow-200 bg-white",
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${statusStyles[s.status]}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Anchor
          </p>
          <p className="text-sm font-medium text-gray-900">
            &ldquo;{s.anchor_text}&rdquo;
          </p>
          {s.anchor_refinement && (
            <p className="text-xs text-blue-600 mt-0.5">
              Suggested: &ldquo;{s.anchor_refinement}&rdquo;
            </p>
          )}
        </div>
        <ConfidenceBadge confidence={s.confidence} />
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Target
        </p>
        <a
          href={s.target_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline truncate block"
        >
          {s.target_url}
        </a>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full"
            style={{ width: `${Math.round(s.relevance_score * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-500 shrink-0">
          {Math.round(s.relevance_score * 100)}% relevant
        </span>
      </div>

      <p className="text-xs text-gray-600 leading-relaxed">{s.justification}</p>

      {s.status === "pending" ? (
        <div className="flex gap-2">
          <button
            onClick={() => onStatusChange(s.id, "approved")}
            className="flex-1 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Approve
          </button>
          <button
            onClick={() => onStatusChange(s.id, "rejected")}
            className="flex-1 py-1.5 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <button
          onClick={() => onStatusChange(s.id, "pending")}
          className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          Undo
        </button>
      )}
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const styles = {
    high: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-gray-100 text-gray-600",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
        styles[confidence as keyof typeof styles] ?? styles.low
      }`}
    >
      {confidence}
    </span>
  );
}

function buildHighlightedDraft(text: string, suggestions: Suggestion[]): string {
  // Apply suggestion highlights to plain text first, then render as markdown
  const sorted = [...suggestions]
    .filter((s) => s.char_start >= 0 && s.char_end > s.char_start)
    .sort((a, b) => b.char_start - a.char_start);

  let result = text;
  for (const s of sorted) {
    const before = result.slice(0, s.char_start);
    const anchor = result.slice(s.char_start, s.char_end);
    const after = result.slice(s.char_end);

    const colorClass =
      s.status === "approved"
        ? "bg-green-100 text-green-900 border-b-2 border-green-400"
        : s.status === "rejected"
        ? "bg-gray-100 text-gray-500 line-through"
        : "bg-yellow-100 text-yellow-900 border-b-2 border-yellow-400";

    result =
      before +
      `<mark class="${colorClass} px-0.5 rounded-sm cursor-default" title="${escapeAttr(s.target_url)}">${anchor}</mark>` +
      after;
  }

  return marked.parse(result, { breaks: true }) as string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
