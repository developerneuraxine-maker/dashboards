import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, logActivity } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatIST } from "@/lib/ist";
import { Play, Pause, Square, Coffee } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/time")({
  head: () => ({ meta: [{ title: "Time Tracker — Pulseboard" }] }),
  component: TimePage,
});

function TimePage() {
  const { user } = useAuthUser();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);

  const { data: active } = useQuery({
    queryKey: ["time-active", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("time_sessions").select("*").eq("user_id", user!.id).neq("status", "ended").order("started_at", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const { data: today } = useQuery({
    queryKey: ["time-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      return (await supabase.from("time_sessions").select("*").eq("user_id", user!.id).gte("started_at", start.toISOString()).order("started_at", { ascending: false })).data ?? [];
    },
  });

  const elapsed = active && active.status !== "ended"
    ? Math.max(0, Math.floor((now - new Date(active.last_resumed_at ?? active.started_at).getTime()) / 1000)) +
      (active.status === "paused" ? 0 : 0)
    : 0;
  const sessionTotal = active
    ? Math.max(0, Math.floor((now - new Date(active.started_at).getTime()) / 1000)) - (active.paused_seconds ?? 0) - (active.status === "paused" ? Math.floor((now - new Date(active.last_resumed_at ?? active.started_at).getTime()) / 1000) : 0)
    : 0;

  const start = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("time_sessions").insert({ user_id: user!.id, status: "active" });
      if (error) throw error;
      await logActivity("started work session", { type: "time_session" });
    },
    onSuccess: () => { toast.success("Timer started"); qc.invalidateQueries({ queryKey: ["time-active"] }); qc.invalidateQueries({ queryKey: ["time-today"] }); },
  });
  const pause = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const { error } = await supabase.from("time_sessions").update({ status: "paused", last_resumed_at: new Date().toISOString() }).eq("id", active.id);
      if (error) throw error;
      await logActivity("paused work session", { type: "time_session", id: active.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time-active"] }),
  });
  const resume = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const pauseDur = Math.floor((Date.now() - new Date(active.last_resumed_at ?? active.started_at).getTime()) / 1000);
      const { error } = await supabase.from("time_sessions").update({
        status: "active",
        last_resumed_at: new Date().toISOString(),
        paused_seconds: (active.paused_seconds ?? 0) + pauseDur,
        break_seconds: (active.break_seconds ?? 0) + pauseDur,
      }).eq("id", active.id);
      if (error) throw error;
      await logActivity("resumed work session", { type: "time_session", id: active.id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["time-active"] }),
  });
  const end = useMutation({
    mutationFn: async () => {
      if (!active) return;
      let pauseAdd = 0;
      if (active.status === "paused") {
        pauseAdd = Math.floor((Date.now() - new Date(active.last_resumed_at ?? active.started_at).getTime()) / 1000);
      }
      const { error } = await supabase.from("time_sessions").update({
        status: "ended",
        ended_at: new Date().toISOString(),
        paused_seconds: (active.paused_seconds ?? 0) + pauseAdd,
        break_seconds: (active.break_seconds ?? 0) + pauseAdd,
      }).eq("id", active.id);
      if (error) throw error;
      await logActivity("ended work session", { type: "time_session", id: active.id });
    },
    onSuccess: () => { toast.success("Session ended"); qc.invalidateQueries({ queryKey: ["time-active"] }); qc.invalidateQueries({ queryKey: ["time-today"] }); },
  });

  const dayTotal = (today ?? []).reduce((acc: number, s: any) => {
    const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
    return acc + Math.max(0, Math.floor((end - new Date(s.started_at).getTime()) / 1000) - (s.paused_seconds ?? 0));
  }, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Time Tracker</h1>
        <p className="text-sm text-muted-foreground">Start a session, take breaks, end the day.</p>
      </div>

      <Card className="glass-strong">
        <CardContent className="flex flex-col items-center gap-6 p-10">
          <div className="text-7xl font-bold tabular-nums tracking-tight gradient-text">
            {formatDuration(sessionTotal)}
          </div>
          <div className="flex items-center gap-2">
            {!active && (
              <Button size="lg" onClick={() => start.mutate()} className="bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]"><Play className="mr-2 size-4" /> Start work</Button>
            )}
            {active?.status === "active" && (
              <>
                <Button size="lg" variant="outline" onClick={() => pause.mutate()}><Pause className="mr-2 size-4" /> Pause (break)</Button>
                <Button size="lg" variant="destructive" onClick={() => end.mutate()}><Square className="mr-2 size-4" /> End</Button>
              </>
            )}
            {active?.status === "paused" && (
              <>
                <Badge className="bg-warning/20 text-warning"><Coffee className="mr-1 size-3" /> On break</Badge>
                <Button size="lg" onClick={() => resume.mutate()} className="bg-[image:var(--gradient-primary)] text-primary-foreground"><Play className="mr-2 size-4" /> Resume</Button>
                <Button size="lg" variant="destructive" onClick={() => end.mutate()}><Square className="mr-2 size-4" /> End</Button>
              </>
            )}
          </div>
          <div className="grid grid-cols-3 gap-8 text-center text-sm">
            <Stat label="Today total" value={formatDuration(dayTotal)} />
            <Stat label="Breaks" value={formatDuration((today ?? []).reduce((a: number, s: any) => a + (s.break_seconds ?? 0), 0))} />
            <Stat label="Sessions" value={String((today ?? []).length)} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader><CardTitle>Today's sessions</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(today ?? []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 p-3 text-sm">
              <div><div className="font-medium">{formatIST(s.started_at)}</div><div className="text-xs text-muted-foreground">→ {s.ended_at ? formatIST(s.ended_at) : "ongoing"}</div></div>
              <Badge variant="outline" className="capitalize">{s.status}</Badge>
            </div>
          ))}
          {(today ?? []).length === 0 && <div className="text-sm text-muted-foreground">No sessions today.</div>}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-xl font-semibold">{value}</div></div>;
}
