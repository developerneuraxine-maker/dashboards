import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatIST } from "@/lib/ist";
import { Bell, CheckCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — Pulseboard" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuthUser();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel("notif-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => qc.invalidateQueries({ queryKey: ["notifications", user.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  const markAll = useMutation({
    mutationFn: async () => { await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Real-time alerts about tasks, leave and reports.</p>
        </div>
        <Button variant="outline" onClick={() => markAll.mutate()}><CheckCheck className="mr-1 size-4" /> Mark all read</Button>
      </div>

      <Card className="glass">
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4" /> Inbox</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {(data ?? []).map((n: any) => (
            <div key={n.id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${n.read ? "border-border/40 bg-background/40" : "border-primary/30 bg-primary/5"}`}>
              <div className="flex items-start gap-3">
                <div className={`mt-1 size-2 rounded-full ${n.read ? "bg-muted" : "bg-primary"}`} />
                <div>
                  <div className="font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                  <div className="mt-1 text-xs text-muted-foreground">{formatIST(n.created_at)}</div>
                </div>
              </div>
              <Badge variant="outline" className="capitalize">{n.category}</Badge>
            </div>
          ))}
          {(data ?? []).length === 0 && <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">You're all caught up.</div>}
        </CardContent>
      </Card>
    </div>
  );
}
