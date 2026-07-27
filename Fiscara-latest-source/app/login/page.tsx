import Link from "next/link";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";
import { redirect } from "next/navigation";
import Brand from "../ui/Brand";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getChatGPTUser();
  if (user) redirect("/dashboard");

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div>
          <p className="eyebrow"><span /> Your private money space</p>
          <h1>Clarity starts with one honest number.</h1>
          <p>Sign in to build a personal dashboard that belongs only to you—your spending, your goals, your pace.</p>
        </div>
        <div className="auth-quote"><span>Private by design</span><span>Calm by intention</span><span>Useful every week</span></div>
      </section>
      <section className="auth-panel">
        <div className="login-card">
          <div className="login-icon" lang="ml">ഫി</div>
          <h2>Welcome to Fiscara</h2>
          <p>Continue securely to your personal finance space.</p>
          <Link className="sign-in-button" href={chatGPTSignInPath("/dashboard")}>
            <span>✦</span> Continue with ChatGPT
          </Link>
          <div className="login-divider">or explore first</div>
          <Link className="demo-link" href="/demo">Open a sample dashboard →</Link>
          <p className="login-note">Your dashboard is separated from other users. Fiscara never sells your financial information.</p>
        </div>
      </section>
    </main>
  );
}
