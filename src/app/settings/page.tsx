import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const serviceClient = await createServiceClient();
  const { data: token } = await serviceClient
    .from("google_tokens")
    .select("scope, expires_at")
    .eq("user_id", user.id)
    .single();

  const isConnected = !!token;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">
          Dashboard
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-medium text-gray-900">Settings</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

        {/* Google Docs connection */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="font-semibold text-gray-900">Google Docs</h2>
              <p className="text-sm text-gray-500 mt-1">
                Connect your Google account to apply link suggestions directly to your Google Docs.
              </p>
              {isConnected && (
                <p className="text-xs text-green-600 mt-2 font-medium">Connected</p>
              )}
            </div>
            <a
              href="/api/auth/google"
              className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg ${
                isConnected
                  ? "border border-gray-300 text-gray-600 hover:bg-gray-50"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {isConnected ? "Reconnect" : "Connect Google"}
            </a>
          </div>
        </div>

        {/* Account */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900">Account</h2>
          <p className="text-sm text-gray-500 mt-1">{user.email}</p>
          <form action="/api/auth/signout" method="POST" className="mt-4">
            <button className="text-sm text-red-600 hover:text-red-700 font-medium">
              Sign out
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
