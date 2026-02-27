import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewProjectModal from "@/components/NewProjectModal";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: projects } = await supabase
    .from("projects")
    .select("*, pages(count), articles(count)")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-wrap justify-between items-center gap-3">
        <h1 className="text-lg font-bold text-gray-900">MyLinks</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500 hidden sm:inline">{user.email}</span>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Settings
          </Link>
          <form action="/api/auth/signout" method="POST">
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
            <p className="text-sm text-gray-500 mt-1">
              Each project tracks one website&apos;s page inventory.
            </p>
          </div>
          <NewProjectModal />
        </div>

        {!projects || projects.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-500 text-sm">No projects yet.</p>
            <p className="text-gray-400 text-sm mt-1">
              Create one to start linking.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => {
              const pageCount =
                (project.pages as unknown as { count: number }[])?.[0]?.count ?? 0;
              const articleCount =
                (project.articles as unknown as { count: number }[])?.[0]?.count ?? 0;

              return (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-gray-900 truncate">
                    {project.name}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 truncate">
                    {project.domain}
                  </p>
                  <div className="flex gap-4 mt-4 text-sm text-gray-600">
                    <span>
                      <strong className="text-gray-900">{pageCount}</strong> pages
                    </span>
                    <span>
                      <strong className="text-gray-900">{articleCount}</strong> articles
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
