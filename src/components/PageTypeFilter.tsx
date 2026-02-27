"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

export default function PageTypeFilter({
  typeCounts,
}: {
  typeCounts: Record<string, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("page_type") ?? "";

  const types = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);

  function select(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("page_type", value);
    } else {
      params.delete("page_type");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => select(e.target.value)}
      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <option value="">All types</option>
      {types.map(([type, count]) => (
        <option key={type} value={type}>
          {type} ({count})
        </option>
      ))}
    </select>
  );
}
