"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  projectId: string;
  currentPage: number;
  totalPages: number;
  perPage: number;
}

export default function PaginationControls({
  projectId,
  currentPage,
  totalPages,
  perPage,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(newPage: number, newPerPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(newPage));
    params.set("per_page", String(newPerPage));
    router.push(`/projects/${projectId}?${params.toString()}`);
  }

  return (
    <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <span>Rows per page:</span>
        {[20, 50].map((n) => (
          <button
            key={n}
            onClick={() => navigate(1, n)}
            className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
              perPage === n
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span>
          Page <strong className="text-gray-900">{currentPage}</strong> of{" "}
          <strong className="text-gray-900">{totalPages}</strong>
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => navigate(currentPage - 1, perPage)}
            disabled={currentPage <= 1}
            className="px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <button
            onClick={() => navigate(currentPage + 1, perPage)}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
