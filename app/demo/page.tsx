import Dashboard from "../ui/Dashboard";

export default function DemoPage() {
  return <Dashboard demo user={{ name: "Alex", email: "demo@fiscara.app" }} signOutHref="/" />;
}
