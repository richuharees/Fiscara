import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import Dashboard from "../ui/Dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireChatGPTUser("/dashboard");
  return <Dashboard user={{ name: user.displayName, email: user.email }} signOutHref={chatGPTSignOutPath("/")} />;
}
