import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIST } from "@/lib/ist";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity Log — Pulseboard" }] }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data: role } = useMyRole();
  const { data } = useQuery({
    queryKey: ["activity-log"],
    queryFn: async () => (await supabase.from("activity_logs").select("*, profile:user_id(full_name,photo_url)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  if (role !== "admin" && role !== "manager") {
    return <div className="rounded-xl border border-border/40 p-8 text-center text-muted-foreground">Managers and admins only.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Every meaningful action — with IST timestamps.</p>
      </div>

      <Card className="glass">
        <CardHeader><CardTitle>Recent</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data ?? []).map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/40 p-3 text-sm">
              <Avatar className="size-8"><AvatarImage src={a.profile?.photo_url} /><AvatarFallback>{(a.profile?.full_name ?? "?").slice(0, 1)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><div><span className="font-medium">{a.profile?.full_name ?? "Someone"}</span> {a.action}</div><div className="text-xs text-muted-foreground">{formatIST(a.created_at)}{a.entity_type ? ` • ${a.entity_type}` : ""}</div></div>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="text-sm text-muted-foreground">No activity yet.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
