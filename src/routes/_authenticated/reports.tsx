import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyRole, logActivity } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatISTDate } from "@/lib/ist";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Pulseboard" }] }),
  component: ReportsPage,
});

const STATUS_COLOR: Record<string, string> = {
  submitted: "bg-primary/20 text-primary",
  approved: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
  changes_requested: "bg-warning/20 text-warning",
};

function ReportsPage() {
  const { user } = useAuthUser();
  const { data: role } = useMyRole();
  const isManager = role === "manager" || role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"daily" | "weekly" | "monthly">("daily");

  const { data: reports } = useQuery({
    queryKey: ["reports", tab, role],
    queryFn: async () => (await supabase.from("reports").select("*, profile:user_id(full_name)").eq("type", tab).order("created_at", { ascending: false })).data ?? [],
  });

  const review = useMutation({
    mutationFn: async ({ id, status, userId }: { id: string; status: string; userId: string }) => {
      const { error } = await supabase.from("reports").update({ status: status as any, reviewed_by: user!.id }).eq("id", id);
      if (error) throw error;
      await supabase.from("notifications").insert({ user_id: userId, title: `Report ${status.replace("_", " ")}`, body: `Your ${tab} report was ${status.replace("_", " ")}.`, category: "report", link: "/reports" });
      await logActivity(`report ${status}`, { type: "report", id });
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["reports"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Daily, weekly and monthly work reports.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[image:var(--gradient-primary)] text-primary-foreground"><Plus className="mr-1 size-4" />New report</Button></DialogTrigger>
          <NewReport onClose={() => setOpen(false)} defaultType={tab} />
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={(v: any) => setTab(v)}>
        <TabsList><TabsTrigger value="daily">Daily</TabsTrigger><TabsTrigger value="weekly">Weekly</TabsTrigger><TabsTrigger value="monthly">Monthly</TabsTrigger></TabsList>
        <TabsContent value={tab} className="mt-4 space-y-3">
          {(reports ?? []).map((r: any) => (
            <Card key={r.id} className="glass">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{r.profile?.full_name ?? "—"} • {formatISTDate(r.report_date)}</CardTitle>
                  <div className="mt-1 text-xs text-muted-foreground capitalize">{r.type} report</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={STATUS_COLOR[r.status]}>{r.status.replace("_", " ")}</Badge>
                  {isManager && r.status === "submitted" && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => review.mutate({ id: r.id, status: "approved", userId: r.user_id })}><Check className="size-4 text-success" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => review.mutate({ id: r.id, status: "rejected", userId: r.user_id })}><X className="size-4 text-destructive" /></Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm md:grid-cols-2">
                {r.tasks_completed && <Field label="Tasks completed" v={r.tasks_completed} />}
                {r.progress && <Field label="Progress" v={r.progress} />}
                {r.issues && <Field label="Issues" v={r.issues} />}
                {r.achievements && <Field label="Achievements" v={r.achievements} />}
                {r.challenges && <Field label="Challenges" v={r.challenges} />}
                {r.notes && <Field label="Notes" v={r.notes} />}
              </CardContent>
            </Card>
          ))}
          {(reports ?? []).length === 0 && <div className="rounded-lg border border-dashed border-border/40 p-8 text-center text-sm text-muted-foreground">No {tab} reports yet.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, v }: { label: string; v: string }) {
  return <div><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 whitespace-pre-wrap">{v}</div></div>;
}

function NewReport({ onClose, defaultType }: { onClose: () => void; defaultType: "daily" | "weekly" | "monthly" }) {
  const { user } = useAuthUser();
  const qc = useQueryClient();
  const [type, setType] = useState(defaultType);
  const [tasksCompleted, setTC] = useState("");
  const [progress, setProgress] = useState("");
  const [issues, setIssues] = useState("");
  const [achievements, setAch] = useState("");
  const [challenges, setCh] = useState("");
  const [notes, setNotes] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reports").insert({
        user_id: user!.id, type, tasks_completed: tasksCompleted || null, progress: progress || null,
        issues: issues || null, achievements: achievements || null, challenges: challenges || null, notes: notes || null,
      });
      if (error) throw error;
      await logActivity(`submitted ${type} report`, { type: "report" });
    },
    onSuccess: () => { toast.success("Submitted"); qc.invalidateQueries({ queryKey: ["reports"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="glass-strong max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>New report</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v: any) => setType(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Field2 label="Tasks completed" v={tasksCompleted} set={setTC} />
        <Field2 label="Progress / summary" v={progress} set={setProgress} />
        <Field2 label="Issues faced" v={issues} set={setIssues} />
        <Field2 label="Achievements" v={achievements} set={setAch} />
        <Field2 label="Challenges" v={challenges} set={setCh} />
        <Field2 label="Notes" v={notes} set={setNotes} />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => submit.mutate()} className="bg-[image:var(--gradient-primary)] text-primary-foreground">Submit</Button>
      </DialogFooter>
    </DialogContent>
  );
}
function Field2({ label, v, set }: { label: string; v: string; set: (s: string) => void }) {
  return <div className="space-y-1"><Label>{label}</Label><Textarea value={v} onChange={(e) => set(e.target.value)} /></div>;
}
