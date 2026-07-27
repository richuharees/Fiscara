import Link from "next/link";
import { chatGPTSignInPath, getChatGPTUser } from "./chatgpt-auth";
import Brand from "./ui/Brand";

const Arrow = () => <span aria-hidden="true">↗</span>;

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <main className="landing">
      <nav className="topbar shell" aria-label="Main navigation">
        <Brand />
        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#security">Security</a>
          <a href="#approach">Our approach</a>
        </div>
        <Link
          className="button button-ghost button-small"
          href={user ? "/dashboard" : "/login"}
        >
          {user ? "Open dashboard" : "Sign in"}
        </Link>
      </nav>

      <section className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Money, without the noise</p>
          <h1>Make every euro feel intentional.</h1>
          <p className="hero-lede">
            Track spending, shape budgets, and grow your goals in one calm,
            private space.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={chatGPTSignInPath("/dashboard")}>
              Start your money plan <Arrow />
            </Link>
            <Link className="button button-ghost" href="/demo">
              Explore the demo
            </Link>
          </div>
          <div className="trust-row">
            <span>Private by design</span>
            <span>No bank connection needed</span>
            <span>Built around you</span>
          </div>
        </div>

        <div className="hero-product" aria-label="Fiscara dashboard preview">
          <div className="product-glow" />
          <div className="preview-window">
            <div className="preview-sidebar">
              <span className="mini-mark" lang="ml">ഫി</span>
              {["Overview", "Transactions", "Budget", "Goals"].map((item, i) => (
                <span className={i === 0 ? "active" : ""} key={item}>
                  <i>{["⌘", "↕", "◔", "◎"][i]}</i>{item}
                </span>
              ))}
            </div>
            <div className="preview-main">
              <div className="preview-heading">
                <div><small>Good evening,</small><strong>Alex</strong></div>
                <span>July 2026⌄</span>
              </div>
              <div className="metric-grid">
                <article>
                  <small>Available balance</small>
                  <strong>€3,240</strong>
                  <em className="positive">↑ 8.4%</em>
                </article>
                <article>
                  <small>Spent this month</small>
                  <strong>€1,186</strong>
                  <em>62% of plan</em>
                </article>
                <article className="goal-card">
                  <small>Savings goal</small>
                  <strong>68%</strong>
                  <span className="mini-ring" />
                </article>
              </div>
              <div className="chart-card">
                <div className="chart-title"><strong>Spending rhythm</strong><span>Last 6 months</span></div>
                <div className="chart">
                  {[32, 48, 40, 63, 72, 88, 76].map((height, i) => (
                    <i key={i} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="chart-labels"><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span></div>
              </div>
              <div className="category-strip">
                <span><i className="mint-dot" />Housing <b>€561</b></span>
                <span><i className="violet-dot" />Food <b>€241</b></span>
                <span><i className="blue-dot" />Transport <b>€176</b></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="proof-strip">
        <div className="shell proof-inner">
          <p>Clarity before complexity.</p>
          <p>Progress without pressure.</p>
          <p>Your numbers, your pace.</p>
        </div>
      </section>

      <section className="section shell" id="features">
        <div className="section-heading">
          <p className="eyebrow"><span /> Everything in focus</p>
          <h2>A money routine you’ll actually return to.</h2>
          <p>Fiscara turns financial admin into a short, useful weekly ritual.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card feature-wide">
            <span className="feature-number">01</span>
            <div>
              <h3>See the whole month at a glance</h3>
              <p>Income, spending, savings and available money—without spreadsheet archaeology.</p>
            </div>
            <div className="mini-insight">
              <span>Safe to spend</span><strong>€214</strong><small>until 31 July</small>
            </div>
          </article>
          <article className="feature-card">
            <span className="feature-number">02</span>
            <h3>Budgets that bend, not break</h3>
            <p>Set realistic limits and see early signals before a category runs away.</p>
            <div className="budget-bars">
              <i style={{"--fill":"74%"} as React.CSSProperties} /><i style={{"--fill":"46%"} as React.CSSProperties} /><i style={{"--fill":"31%"} as React.CSSProperties} />
            </div>
          </article>
          <article className="feature-card">
            <span className="feature-number">03</span>
            <h3>Goals with visible momentum</h3>
            <p>Turn a distant savings target into the next small, achievable step.</p>
            <div className="goal-orbit"><strong>68%</strong></div>
          </article>
        </div>
      </section>

      <section className="section security-section" id="security">
        <div className="shell security-inner">
          <div>
            <p className="eyebrow"><span /> Private by default</p>
            <h2>Your financial life is not an advertising profile.</h2>
          </div>
          <div className="security-points">
            <article><b>01</b><div><h3>Personal sign-in</h3><p>Your dashboard is tied to your account and kept separate from every other user.</p></div></article>
            <article><b>02</b><div><h3>Purposeful data</h3><p>We only use the information needed to calculate and display your finances.</p></div></article>
            <article><b>03</b><div><h3>You stay in control</h3><p>Start manually. Add bank integrations only when you decide they are useful.</p></div></article>
          </div>
        </div>
      </section>

      <section className="section shell approach" id="approach">
        <p className="eyebrow"><span /> Behaviourally informed</p>
        <h2>Designed for better decisions—not more screen time.</h2>
        <div className="approach-grid">
          <p>Fiscara reduces shame, removes financial clutter, and presents one clear next action at a time.</p>
          <div className="quote-card">
            <span>This week’s focus</span>
            <strong>Move €35 to your emergency fund.</strong>
            <small>You’ll reach your goal 9 days earlier.</small>
          </div>
        </div>
      </section>

      <section className="final-cta shell">
        <div>
          <p className="eyebrow"><span /> Your next chapter</p>
          <h2>Small choices.<br />Visible progress.</h2>
        </div>
        <div>
          <p>Build a calmer relationship with money—one intentional week at a time.</p>
          <Link className="button button-primary" href={chatGPTSignInPath("/dashboard")}>
            Create your space <Arrow />
          </Link>
        </div>
      </section>

      <footer className="shell footer">
        <Brand />
        <p>Personal finance with clarity and care.</p>
        <span>© 2026 Fiscara</span>
      </footer>
    </main>
  );
}
