"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import type { Database } from "@/lib/types/database";
import { extractGoogleDocId } from "@/lib/utils";

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
  const [linkTab, setLinkTab] = useState<"internal" | "external">("internal");
  const [generating, setGenerating] = useState(false);
  const [generatingExternal, setGeneratingExternal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeSuggestionId, setActiveSuggestionId] = useState<string | null>(null);
  const [showLinkDoc, setShowLinkDoc] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const [linking, setLinking] = useState(false);
  const [cardPositions, setCardPositions] = useState<Record<string, number>>({});
  const articlePanelRef = useRef<HTMLDivElement>(null);
  const suggestionsPanelRef = useRef<HTMLDivElement>(null);
  const cardRefsMap = useRef<Record<string, HTMLDivElement | null>>({});
  const router = useRouter();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function linkGoogleDoc() {
    setLinking(true);
    setError(null);
    const docId = extractGoogleDocId(docUrl);
    const res = await fetch(`/api/articles/${article.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ google_doc_id: docId }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to link Google Doc");
    } else {
      showToast("Google Doc linked — you can now apply suggestions to it");
      setShowLinkDoc(false);
      setDocUrl("");
      router.refresh();
    }
    setLinking(false);
  }

  function scrollToSuggestion(id: string) {
    setActiveSuggestionId(id);

    // Scroll to the highlighted anchor text — both panels scroll together
    const articlePanel = articlePanelRef.current;
    if (articlePanel) {
      const mark = articlePanel.querySelector(`[data-suggestion-id="${id}"]`);
      if (mark) {
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
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
        const newInternal = data.suggestions ?? [];
        // Merge: keep existing external, replace internal
        setSuggestions((prev) => [
          ...prev.filter((s) => s.link_type === "external"),
          ...newInternal,
        ]);
        showToast(`${newInternal.length} internal links suggested`);
      }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function generateExternalSuggestions() {
    setGeneratingExternal(true);
    setError(null);
    setActiveSuggestionId(null);
    try {
      const res = await fetch(`/api/articles/${article.id}/suggest-external`, {
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
        setError(data.error ?? "Failed to generate external suggestions.");
      } else {
        const newExternal = data.suggestions ?? [];
        // Merge: keep existing internal, replace external
        setSuggestions((prev) => [
          ...prev.filter((s) => (s.link_type ?? "internal") !== "external"),
          ...newExternal,
        ]);
        showToast(`${newExternal.length} external links suggested`);
      }
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setGeneratingExternal(false);
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

  const filteredSuggestions = useMemo(
    () => suggestions.filter((s) => (s.link_type ?? "internal") === linkTab),
    [suggestions, linkTab]
  );
  const approvedCount = filteredSuggestions.filter((s) => s.status === "approved").length;
  const pendingCount = filteredSuggestions.filter((s) => s.status === "pending").length;
  const internalCount = suggestions.filter((s) => (s.link_type ?? "internal") === "internal").length;
  const externalCount = suggestions.filter((s) => s.link_type === "external").length;

  const highlightedDraft = useMemo(
    () => buildHighlightedDraft(article.content_text, filteredSuggestions, activeSuggestionId),
    [article.content_text, filteredSuggestions, activeSuggestionId]
  );

  // Compute card positions aligned to their anchor marks
  useEffect(() => {
    const articlePanel = articlePanelRef.current;
    if (!articlePanel || filteredSuggestions.length === 0) return;

    const compute = () => {
      const panelRect = articlePanel.getBoundingClientRect();
      const GAP = 8;

      // Get ideal Y for each suggestion based on its mark position
      const items: { id: string; idealY: number }[] = [];
      for (const s of filteredSuggestions) {
        const mark = articlePanel.querySelector(`[data-suggestion-id="${s.id}"]`);
        if (mark) {
          const markRect = mark.getBoundingClientRect();
          items.push({ id: s.id, idealY: markRect.top - panelRect.top });
        }
      }

      // Sort by ideal Y position
      items.sort((a, b) => a.idealY - b.idealY);

      // Resolve overlaps: push cards down if they'd overlap the previous one
      const positions: Record<string, number> = {};
      let lastBottom = 0;
      for (const item of items) {
        const cardEl = cardRefsMap.current[item.id];
        const cardHeight = cardEl?.offsetHeight ?? 120;
        const y = Math.max(item.idealY, lastBottom);
        positions[item.id] = y;
        lastBottom = y + cardHeight + GAP;
      }

      setCardPositions(positions);
    };

    // Run after DOM paint
    const frame = requestAnimationFrame(compute);
    return () => cancelAnimationFrame(frame);
  }, [filteredSuggestions, activeSuggestionId, highlightedDraft]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-3 shrink-0">
        <div className="flex items-center gap-4">
          {/* Link type tabs */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => { setLinkTab("internal"); setActiveSuggestionId(null); }}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                linkTab === "internal"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Internal{internalCount > 0 ? ` (${internalCount})` : ""}
            </button>
            <button
              onClick={() => { setLinkTab("external"); setActiveSuggestionId(null); }}
              className={`px-3 py-1 text-xs font-medium transition-colors ${
                linkTab === "external"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Authority{externalCount > 0 ? ` (${externalCount})` : ""}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
            <span>
              <strong className="text-gray-900">{filteredSuggestions.length}</strong> suggestions
            </span>
            <span className="text-green-600">
              <strong>{approvedCount}</strong> approved
            </span>
            <span className="text-yellow-600">
              <strong>{pendingCount}</strong> pending
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {article.google_doc_id ? (
            <button
              onClick={applyToGoogleDoc}
              disabled={applying || approvedCount === 0}
              className="px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {applying ? "Applying..." : `Apply ${approvedCount} to Google Doc`}
            </button>
          ) : (
            <button
              onClick={() => setShowLinkDoc(!showLinkDoc)}
              className="px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 text-gray-700"
            >
              Link Google Doc
            </button>
          )}
          {linkTab === "internal" ? (
            <button
              onClick={generateSuggestions}
              disabled={generating}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? "Generating..." : internalCount > 0 ? "Regenerate internal" : "Generate internal links"}
            </button>
          ) : (
            <button
              onClick={generateExternalSuggestions}
              disabled={generatingExternal}
              className="px-3 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {generatingExternal ? "Generating..." : externalCount > 0 ? "Regenerate authority" : "Find authority links"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {showLinkDoc && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3">
          <input
            value={docUrl}
            onChange={(e) => setDocUrl(e.target.value)}
            placeholder="Paste Google Doc URL or ID"
            className="flex-1 min-w-[200px] px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={linkGoogleDoc}
            disabled={linking || !docUrl.trim()}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {linking ? "Linking..." : "Link"}
          </button>
          <button
            onClick={() => { setShowLinkDoc(false); setDocUrl(""); }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Split view — single scroll container */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col sm:flex-row min-h-full">
          {/* Left: Draft */}
          <div
            ref={articlePanelRef}
            onClick={handleArticleClick}
            className="flex-1 p-4 sm:p-5 border-b sm:border-b-0 sm:border-r border-gray-200"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{article.title}</h2>
            <div
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightedDraft }}
            />
          </div>

          {/* Right: Suggestions — positioned alongside anchors */}
          <div
            ref={suggestionsPanelRef}
            className="w-full sm:w-72 md:w-80 lg:w-96 shrink-0 bg-gray-50 relative"
            style={{ minHeight: filteredSuggestions.length > 0 ? Object.values(cardPositions).reduce((max, y) => Math.max(max, y + 200), 0) : undefined }}
          >
            {filteredSuggestions.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">
                {(generating || generatingExternal)
                  ? "Analyzing your article..."
                  : linkTab === "internal"
                    ? "No internal links yet. Click \"Generate internal links\" to start."
                    : "No authority links yet. Click \"Find authority links\" to discover external sources."}
              </div>
            ) : (
              filteredSuggestions.map((s) => (
                <div
                  key={s.id}
                  ref={(el) => { cardRefsMap.current[s.id] = el; }}
                  className="absolute left-0 right-0 px-3 transition-[top] duration-200"
                  style={{ top: cardPositions[s.id] ?? 0 }}
                >
                  <SuggestionCard
                    suggestion={s}
                    isActive={s.id === activeSuggestionId}
                    isExternal={linkTab === "external"}
                    onStatusChange={updateStatus}
                    onSelect={scrollToSuggestion}
                  />
                </div>
              ))
            )}
          </div>
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
  isExternal,
  onStatusChange,
  onSelect,
}: {
  suggestion: Suggestion;
  isActive: boolean;
  isExternal?: boolean;
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
        className={`text-xs hover:underline truncate block ${isExternal ? "text-purple-600" : "text-blue-600"}`}
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
