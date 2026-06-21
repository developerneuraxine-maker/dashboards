import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyProfile, useMyRole } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatIST, formatISTTime, formatDuration, todayISTDate } from "@/lib/ist";
import {
  Clock, CheckCircle2, Users, AlertCircle, TrendingUp,
  CalendarCheck, Activity as ActivityIcon, Briefcase,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
  AreaChart, Area,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Pulseboard" }] }),
  component: Dashboard,
});

function StatCard({ title, value, icon: Icon, hint, accent }: { title: string; value: string | number; icon: any; hint?: string; accent?: string }) {
  return (
    <Card className="glass overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
            {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
          </div>
          <div className={`flex size-11 items-center justify-center rounded-xl ${accent ?? "bg-[image:var(--gradient-primary)]"} text-primary-foreground shadow-[var(--shadow-glow)]`}>
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile();
  const { data: role } = useMyRole();
  const isManager = role === "admin" || role === "manager";

  const today = todayISTDate();

  const { data: stats } = useQuery({
    queryKey: ["dash-stats", user?.id, role],
    enabled: !!user,
    queryFn: async () => {
      const [tasksMine, tasksAll, presentToday, openLeaves, employeesCnt] = await Promise.all([
        supabase.from("tasks").select("status", { count: "exact" }).eq("assigned_to", user!.id),
        isManager ? supabase.from("tasks").select("status", { count: "exact" }) : Promise.resolve({ data: [], count: 0 } as any),
        supabase.from("attendance").select("id", { count: "exact", head: true }).eq("date", today).in("status", ["present", "late", "half_day"]),
        supabase.from("leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const mine = (tasksMine.data ?? []) as { status: string }[];
      return {
        myTotal: mine.length,
        myDone: mine.filter((t) => t.status === "completed").length,
        myPending: mine.filter((t) => t.status !== "completed").length,
        teamTotal: tasksAll.count ?? 0,
        presentToday: presentToday.count ?? 0,
        openLeaves: openLeaves.count ?? 0,
        employeesCnt: employeesCnt.count ?? 0,
      };
    },
  });

  const { data: weekly } = useQuery({
    queryKey: ["dash-week", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 6);
      const { data } = await supabase
        .from("time_sessions")
        .select("started_at,ended_at,paused_seconds,user_id")
        .gte("started_at", since.toISOString())
        .eq("user_id", user!.id);
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return { day: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }), seconds: 0, date: d.toISOString().slice(0, 10) };
      });
      (data ?? []).forEach((s) => {
        const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
        const start = new Date(s.started_at).getTime();
        const sec = Math.max(0, Math.floor((end - start) / 1000) - (s.paused_seconds ?? 0));
        const key = new Date(s.started_at).toISOString().slice(0, 10);
        const b = buckets.find((x) => x.date === key);
        if (b) b.seconds += sec;
      });
      return buckets.map((b) => ({ day: b.day, hours: +(b.seconds / 3600).toFixed(2) }));
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["dash-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id,action,entity_type,created_at,user_id,meta,profiles:user_id(full_name,photo_url)")
        .order("created_at", { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, <span className="gradient-text">{profile?.full_name?.split(" ")[0] ?? "there"}</span></h1>
          <p className="text-sm text-muted-foreground">Here's what's happening across your workspace right now.</p>
        </div>
        <Badge variant="outline" className="w-fit border-success/40 bg-success/10 text-success">
          <span className="mr-1 size-1.5 rounded-full bg-success animate-pulse" /> Live • IST
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="My Tasks" value={stats?.myTotal ?? 0} icon={Briefcase} hint={`${stats?.myDone ?? 0} completed`} />
        <StatCard title="Pending" value={stats?.myPending ?? 0} icon={AlertCircle} accent="bg-warning" />
        <StatCard title="Present Today" value={stats?.presentToday ?? 0} icon={CalendarCheck} accent="bg-success" />
        {isManager ? (
          <StatCard title="Employees" value={stats?.employeesCnt ?? 0} icon={Users} />
        ) : (
          <StatCard title="Open Leaves" value={stats?.openLeaves ?? 0} icon={Clock} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="glass lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="size-4" /> Hours worked this week</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly ?? []}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.18 260)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.72 0.18 260)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="day" stroke="oklch(0.7 0.02 260)" fontSize={12} />
                <YAxis stroke="oklch(0.7 0.02 260)" fontSize={12} />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.025 265)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }} />
                <Area type="monotone" dataKey="hours" stroke="oklch(0.72 0.18 260)" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ActivityIcon className="size-4" /> Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(recent ?? []).map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate"><span className="font-medium">{a.profiles?.full_name ?? "Someone"}</span> {a.action}</div>
                  <div className="text-xs text-muted-foreground">{formatISTTime(a.created_at)}</div>
                </div>
              </div>
            ))}
            {(recent ?? []).length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
