import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Pulseboard" }] }),
  component: AnalyticsPage,
});

const COLORS = ["oklch(0.72 0.18 260)", "oklch(0.72 0.17 155)", "oklch(0.82 0.16 80)", "oklch(0.65 0.2 320)", "oklch(0.78 0.14 200)"];

function AnalyticsPage() {
  const { data: role } = useMyRole();

  const { data: weeklyHours } = useQuery({
    queryKey: ["an-weekly-hours"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 13);
      const { data } = await supabase.from("time_sessions").select("started_at,ended_at,paused_seconds").gte("started_at", since.toISOString());
      const buckets = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (13 - i));
        return { day: d.toLocaleDateString("en-IN", { month: "short", day: "2-digit", timeZone: "Asia/Kolkata" }), hours: 0, key: d.toISOString().slice(0, 10) };
      });
      (data ?? []).forEach((s: any) => {
        const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
        const sec = Math.max(0, Math.floor((end - new Date(s.started_at).getTime()) / 1000) - (s.paused_seconds ?? 0));
        const k = new Date(s.started_at).toISOString().slice(0, 10);
        const b = buckets.find((x) => x.key === k);
        if (b) b.hours += sec / 3600;
      });
      return buckets.map((b) => ({ day: b.day, hours: +b.hours.toFixed(2) }));
    },
  });

  const { data: attendanceTrend } = useQuery({
    queryKey: ["an-att-trend"],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 13);
      const { data } = await supabase.from("attendance").select("date,status").gte("date", since.toISOString().slice(0, 10));
      const grouped: Record<string, { present: number; absent: number; late: number }> = {};
      (data ?? []).forEach((r: any) => {
        grouped[r.date] ??= { present: 0, absent: 0, late: 0 };
        if (r.status === "late") grouped[r.date].late += 1;
        else if (r.status === "absent") grouped[r.date].absent += 1;
        else grouped[r.date].present += 1;
      });
      return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date: date.slice(5), ...v }));
    },
  });

  const { data: taskBreakdown } = useQuery({
    queryKey: ["an-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("status");
      const tally: Record<string, number> = {};
      (data ?? []).forEach((t: any) => { tally[t.status] = (tally[t.status] ?? 0) + 1; });
      return Object.entries(tally).map(([name, value]) => ({ name: name.replace("_", " "), value }));
    },
  });

  const { data: byDept } = useQuery({
    queryKey: ["an-by-dept"],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("status, department:department_id(name)");
      const tally: Record<string, { name: string; total: number; done: number }> = {};
      (data ?? []).forEach((t: any) => {
        const k = t.department?.name ?? "Unassigned";
        tally[k] ??= { name: k, total: 0, done: 0 };
        tally[k].total += 1;
        if (t.status === "completed") tally[k].done += 1;
      });
      return Object.values(tally);
    },
  });

  if (role !== "admin" && role !== "manager") {
    return <div className="rounded-xl border border-border/40 p-8 text-center text-muted-foreground">Managers and admins only.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Productivity trends across your workforce.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="glass">
          <CardHeader><CardTitle>Hours worked — last 14 days</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <AreaChart data={weeklyHours ?? []}>
                <defs>
                  <linearGradient id="ah" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 260)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 260)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="day" stroke="oklch(0.7 0.02 260)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 260)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.025 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="hours" stroke="oklch(0.72 0.18 260)" fill="url(#ah)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Attendance trend</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={attendanceTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="date" stroke="oklch(0.7 0.02 260)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 260)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.025 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="present" stackId="a" fill="oklch(0.72 0.17 155)" />
                <Bar dataKey="late" stackId="a" fill="oklch(0.82 0.16 80)" />
                <Bar dataKey="absent" stackId="a" fill="oklch(0.65 0.22 25)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Task status breakdown</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={taskBreakdown ?? []} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={4}>
                  {(taskBreakdown ?? []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.18 0.025 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader><CardTitle>Department performance</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer>
              <BarChart data={byDept ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="name" stroke="oklch(0.7 0.02 260)" fontSize={11} />
                <YAxis stroke="oklch(0.7 0.02 260)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.025 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                <Legend />
                <Bar dataKey="total" fill="oklch(0.72 0.18 260)" radius={[8, 8, 0, 0]} />
                <Bar dataKey="done" fill="oklch(0.72 0.17 155)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
