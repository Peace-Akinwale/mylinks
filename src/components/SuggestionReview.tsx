"use client";

import { useState, useCallback, useMemo, useRef } from "react";
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
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const articlePanelRef = useRef<HTMLDivElement>(null);
  const suggestionsPanelRef = useRef<HTMLDivElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function scrollToSuggestion(id: string) {
    setActiveSuggestionId(id);

    // Scroll article to the highlighted anchor text
    const articlePanel = articlePanelRef.current;
    if (articlePanel) {
      const mark = articlePanel.querySelector(`[data-suggestion-id="${id}"]`);
      if (mark) {
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    // Scroll right panel so the card + its Approve button are visible
    const suggestionsPanel = suggestionsPanelRef.current;
    if (suggestionsPanel) {
      const card = suggestionsPanel.querySelector(`[data-card-id="${id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }

  function handleArticleClick(e: React.MouseEvent<HTMLDivElement>) {
    const mark = (e.target as HTMLElement).closest("[data-suggestion-id]");
    if (mark) {
      const id = mark.getAttribute("data-suggestion-id");
      if (id) scrollToSuggestion(id);
    }
  }

  async function generateSuggestions() {
    setGenerating(true);
    setError(null);
    setActiveSuggestionId(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/suggest`, {
        method: "POST",
      });

      if (res.status === 504) {
        setError("Request timed out — please try again.");
        return;
      }

      let data: { error?: string; suggestions?: Suggestion[] };
      try {
        data = await res.json();
      } catch {
        setError("Unexpected response from server — please try again.");
        return;
      }

      if (!res.ok) {
        setError(data.error ?? "Failed to generate suggestions.");
      } else {
        setSuggestions(data.suggestions ?? []);
        showToast(`${(data.suggestions ?? []).length} suggestions generated`);
      }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
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

  const highlightedDraft = useMemo(
    () => buildHighlightedDraft(article.content_text, suggestions, activeSuggestionId),
    [article.content_text, suggestions, activeSuggestionId]
  );

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
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
        <div className="flex flex-wrap gap-3">
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
      <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
        {/* Left: Draft */}
        <div
          ref={articlePanelRef}
          onClick={handleArticleClick}
          className="flex-1 min-h-[40vh] overflow-y-auto p-4 sm:p-5 border-b sm:border-b-0 sm:border-r border-gray-200"
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{article.title}</h2>
          <div
            className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedDraft }}
          />
        </div>

        {/* Right: Suggestions */}
        <div ref={suggestionsPanelRef} className="w-full sm:w-72 md:w-80 lg:w-96 shrink-0 overflow-y-auto p-3 space-y-2 bg-gray-50">
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
                isActive={s.id === activeSuggestionId}
                onStatusChange={updateStatus}
                onSelect={scrollToSuggestion}
              />
            ))
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg text-center sm:text-left">
          {toast}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  suggestion: s,
  isActive,
  onStatusChange,
  onSelect,
}: {
  suggestion: Suggestion;
  isActive: boolean;
  onStatusChange: (id: string, status: "approved" | "rejected" | "pending") => void;
  onSelect: (id: string) => void;
}) {
  const statusStyles = {
    approved: "border-green-300 bg-green-50",
    rejected: "border-gray-200 bg-gray-100 opacity-60",
    pending: "border-yellow-200 bg-white",
  };

  return (
    <div
      data-card-id={s.id}
      className={`rounded-lg border p-3 space-y-2 transition-shadow cursor-pointer ${statusStyles[s.status]} ${
        isActive ? "ring-2 ring-blue-400 shadow-md" : "hover:shadow-sm"
      }`}
      onClick={() => onSelect(s.id)}
    >
      {/* Anchor + confidence */}
      <div className="flex justify-between items-start gap-2">
        <p className="text-xs font-semibold text-gray-900 leading-snug flex-1 min-w-0">
          &ldquo;{s.anchor_text}&rdquo;
        </p>
        <ConfidenceBadge confidence={s.confidence} />
      </div>

      {/* Target URL */}
      <a
        href={s.target_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-xs text-blue-600 hover:underline truncate block"
      >
        {s.target_url}
      </a>

      {/* Relevance bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-200 rounded-full h-1">
          <div
            className="bg-blue-500 h-1 rounded-full"
            style={{ width: `${Math.round(s.relevance_score * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {Math.round(s.relevance_score * 100)}%
        </span>
      </div>

      {/* Justification — only shown when active */}
      {isActive && (
        <p className="text-xs text-gray-500 leading-relaxed">{s.justification}</p>
      )}

      {s.status === "pending" ? (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onStatusChange(s.id, "approved")}
            className="flex-1 py-1 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Approve
          </button>
          <button
            onClick={() => onStatusChange(s.id, "rejected")}
            className="flex-1 py-1 text-xs font-medium border border-gray-300 text-gray-600 rounded-md hover:bg-gray-50"
          >
            Reject
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onStatusChange(s.id, "pending"); }}
          className="w-full py-1 text-xs text-gray-500 hover:text-gray-700"
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

function buildHighlightedDraft(
  text: string,
  suggestions: Suggestion[],
  activeId: string | null
): string {
  const sorted = [...suggestions]
    .filter((s) => s.char_start >= 0 && s.char_end > s.char_start)
    .sort((a, b) => b.char_start - a.char_start);

  let result = text;
  for (const s of sorted) {
    const before = result.slice(0, s.char_start);
    const anchor = result.slice(s.char_start, s.char_end);
    const after = result.slice(s.char_end);
    const isActive = s.id === activeId;

    let colorClass: string;
    if (s.status === "approved") {
      colorClass = isActive
        ? "bg-green-200 text-green-900 border-b-2 border-green-600 outline outline-2 outline-blue-400 rounded-sm"
        : "bg-green-100 text-green-900 border-b-2 border-green-400";
    } else if (s.status === "rejected") {
      colorClass = "bg-gray-100 text-gray-500 line-through";
    } else {
      colorClass = isActive
        ? "bg-yellow-200 text-yellow-900 border-b-2 border-yellow-500 outline outline-2 outline-blue-400 rounded-sm"
        : "bg-yellow-100 text-yellow-900 border-b-2 border-yellow-400";
    }

    const mark = `<mark class="${colorClass} px-0.5 rounded-sm" data-suggestion-id="${s.id}">${anchor}</mark>`;

    // Approved anchors are real clickable links in the preview
    const inner =
      s.status === "approved"
        ? `<a href="${escapeAttr(s.target_url)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${mark}</a>`
        : mark;

    result = before + inner + after;
  }

  return marked.parse(result, { breaks: true }) as string;
}

function escapeAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
