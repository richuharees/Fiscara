import { redirect } from "next/navigation";
import { chatGPTSignOutPath } from "../chatgpt-auth";
import Dashboard from "../ui/Dashboard";
import { createClient } from "../../lib/supabase/server";
import SessionBootstrap from "./SessionBootstrap";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const user = userData.user;
  const session = sessionData.session;
  if (!user?.email || !session?.access_token || !session.refresh_token) {
    redirect("/login?return_to=%2Fdashboard");
  }

  const fullName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : null;
  const displayName = fullName ?? user.email.split("@")[0];

  return (
    <SessionBootstrap session={{ access_token: session.access_token, refresh_token: session.refresh_token }}>
      <Dashboard
        user={{ name: displayName, email: user.email }}
        signOutHref={chatGPTSignOutPath("/")}
      />
    </SessionBootstrap>
  );
}
