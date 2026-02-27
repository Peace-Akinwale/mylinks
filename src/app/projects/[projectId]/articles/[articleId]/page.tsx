import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SuggestionReview from "@/components/SuggestionReview";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ projectId: string; articleId: string }>;
}) {
  const { projectId, articleId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", articleId)
    .single();

  if (!article) notFound();

  const { data: suggestions } = await supabase
    .from("suggestions")
    .select("*")
    .eq("article_id", articleId)
    .order("sort_order");

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 shrink-0">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href={`/projects/${projectId}`}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          {project?.name ?? "Project"}
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900 truncate max-w-xs">
          {article.title}
        </span>
      </nav>

      <SuggestionReview
        article={article}
        initialSuggestions={suggestions ?? []}
        projectId={projectId}
      />
    </div>
  );
}
