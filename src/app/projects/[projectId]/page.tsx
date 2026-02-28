import { Suspense } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CrawlButton from "@/components/CrawlButton";
import EditProjectModal from "@/components/EditProjectModal";
import PageTypeFilter from "@/components/PageTypeFilter";
import PaginationControls from "@/components/PaginationControls";
import type { PageType } from "@/lib/types/database";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ page_type?: string; page?: string; per_page?: string; auto_crawl?: string }>;
}) {
  const { projectId } = await params;
  const { page_type, page = "1", per_page = "20", auto_crawl } = await searchParams;
  const autoCrawl = auto_crawl === "1";
  const limit = [20, 50].includes(parseInt(per_page)) ? parseInt(per_page) : 20;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) notFound();

  // Fetch pages
  const currentPage = parseInt(page);
  const offset = (currentPage - 1) * limit;
  let pagesQuery = supabase
    .from("pages")
    .select("*", { count: "exact" })
    .eq("project_id", projectId)
    .order("priority", { ascending: false })
    .range(offset, offset + limit - 1);

  if (page_type) pagesQuery = pagesQuery.eq("page_type", page_type as PageType);

  const { data: pages, count: pageCount } = await pagesQuery;

  // Fetch articles
  const { data: articles } = await supabase
    .from("articles")
    .select("id, title, word_count, created_at, source")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  // Stats
  const { data: stats } = await supabase
    .from("pages")
    .select("page_type")
    .eq("project_id", projectId);

  const typeCounts = (stats ?? []).reduce<Record<string, number>>((acc, p) => {
    acc[p.page_type] = (acc[p.page_type] ?? 0) + 1;
    return acc;
  }, {});

  const totalPages = pageCount ?? 0;
  const totalPageCount = Math.max(1, Math.ceil(totalPages / limit));
  const totalPagesInDB = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px] sm:max-w-xs">{project.name}</span>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-sm text-gray-500 mt-1">{project.domain}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/projects/${projectId}/articles/new`}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              Add article
            </Link>
            <CrawlButton projectId={projectId} autoCrawl={autoCrawl} />
            <EditProjectModal project={project} />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total pages" value={totalPagesInDB} />
          <StatCard label="Blog posts" value={typeCounts["blog_post"] ?? 0} />
          <StatCard label="Articles" value={articles?.length ?? 0} />
          <StatCard label="Services" value={typeCounts["service"] ?? 0} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pages inventory */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap justify-between items-center gap-2">
                <h2 className="font-semibold text-gray-900">Page inventory</h2>
                <Suspense fallback={<span className="text-xs text-gray-400">Loading filter...</span>}>
                  <PageTypeFilter typeCounts={typeCounts} />
                </Suspense>
              </div>

              {!pages || pages.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-gray-400">
                  {totalPagesInDB === 0
                    ? "No pages crawled yet. Click \"Crawl\" to start."
                    : "No pages match this filter."}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {pages.map((p) => (
                    <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${pageTypeColor(p.page_type)}`}>
                        {p.page_type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {p.title || p.url}
                        </p>
                        <p className="text-xs text-gray-400 truncate">{p.url}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        P{p.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {totalPages > 0 && (
                <Suspense fallback={null}>
                  <PaginationControls
                    projectId={projectId}
                    currentPage={currentPage}
                    totalPages={totalPageCount}
                    perPage={limit}
                  />
                </Suspense>
              )}
            </div>
          </div>

          {/* Articles */}
          <div>
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Articles</h2>
              </div>

              {!articles || articles.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-gray-400">
                  No articles yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {articles.map((a) => (
                    <Link
                      key={a.id}
                      href={`/projects/${projectId}/articles/${a.id}`}
                      className="block px-5 py-3 hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {a.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {a.word_count ? `${a.word_count} words` : a.source}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-5 py-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

function pageTypeColor(type: string): string {
  const map: Record<string, string> = {
    blog_post: "bg-blue-50 text-blue-700",
    homepage: "bg-purple-50 text-purple-700",
    category: "bg-yellow-50 text-yellow-700",
    product: "bg-green-50 text-green-700",
    service: "bg-indigo-50 text-indigo-700",
    landing: "bg-orange-50 text-orange-700",
    about: "bg-gray-100 text-gray-600",
    contact: "bg-gray-100 text-gray-600",
    other: "bg-gray-100 text-gray-500",
  };
  return map[type] ?? "bg-gray-100 text-gray-500";
}
