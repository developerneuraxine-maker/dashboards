import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Clock, Users, CheckCircle2, Calendar, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pulseboard — Employee Management & Workforce Tracking" },
      { name: "description", content: "Monitor productivity, assign tasks, track attendance and work hours in real time — built for modern enterprises." },
      { property: "og:title", content: "Pulseboard — Workforce Productivity Platform" },
      { property: "og:description", content: "Tasks, attendance, time-tracking, leave and analytics in one premium dashboard." },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: CheckCircle2, title: "Task Management", desc: "Kanban boards, priorities, comments, and full task history." },
  { icon: Clock, title: "Time Tracking", desc: "Start, pause and resume work timers with break tracking." },
  { icon: Calendar, title: "Attendance & Leave", desc: "Check-in / check-out, leave applications and approvals." },
  { icon: Activity, title: "Daily Reports", desc: "Daily, weekly and monthly reports with manager review." },
  { icon: Users, title: "Team Visibility", desc: "Departments, profiles, roles and live activity logs." },
  { icon: BarChart3, title: "Productivity Analytics", desc: "Hours worked, attendance %, task completion trends." },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-xl bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]" />
          <span className="text-lg font-semibold tracking-tight">Pulseboard</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/auth"><Button variant="ghost">Sign in</Button></Link>
          <Link to="/auth"><Button>Get started <ArrowRight className="ml-1 size-4" /></Button></Link>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-16 text-center">
        <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success animate-pulse" /> Live workforce intelligence
        </span>
        <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight md:text-7xl">
          The <span className="gradient-text">workforce OS</span><br />for modern teams.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Manage attendance, tasks, time-tracking, leave and reports — all in one premium dashboard.
          Built for managers who care about real productivity.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/auth"><Button size="lg" className="bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]">Start free <ArrowRight className="ml-1 size-4" /></Button></Link>
          <Link to="/auth"><Button size="lg" variant="outline">Sign in</Button></Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-4 px-6 pb-24 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="glass rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)]">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground">
              <f.icon className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Pulseboard. All timestamps in Indian Standard Time.
      </footer>
    </div>
  );
}
