import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyRole, logActivity } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatIST } from "@/lib/ist";
import { Plus, ArrowRight, Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Pulseboard" }] }),
  component: TasksPage,
});

const COLUMNS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
] as const;

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/15 text-primary",
  high: "bg-warning/20 text-warning",
  urgent: "bg-destructive/20 text-destructive",
};

function TasksPage() {
  const { user } = useAuthUser();
  const { data: role } = useMyRole();
  const isManager = role === "manager" || role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: tasks } = useQuery({
    queryKey: ["tasks", user?.id, role],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*, assignee:assigned_to(id,full_name,photo_url), department:department_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const move = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "completed") patch.completed_at = new Date().toISOString();
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
      await logActivity(`moved task to ${status.replace("_", " ")}`, { type: "task", id });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Kanban board • drag your work across stages</p>
        </div>
        {isManager && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[image:var(--gradient-primary)] text-primary-foreground"><Plus className="mr-1 size-4" /> New task</Button>
            </DialogTrigger>
            <NewTaskDialog onClose={() => setOpen(false)} />
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = (tasks ?? []).filter((t) => t.status === col.key);
          return (
            <Card key={col.key} className="glass">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span>{col.label}</span>
                  <Badge variant="outline">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((t: any) => (
                  <div key={t.id} className="rounded-xl border border-border/40 bg-background/40 p-3 transition hover:border-primary/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium leading-snug">{t.title}</div>
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-medium uppercase ${PRIORITY_COLOR[t.priority]}`}><Flag className="mr-1 inline size-3" />{t.priority}</span>
                    </div>
                    {t.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</div>}
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{t.assignee?.full_name ?? "Unassigned"}</span>
                      {t.due_date && <span>Due {formatIST(t.due_date)}</span>}
                    </div>
                    <div className="mt-2 flex gap-1">
                      {COLUMNS.filter((c) => c.key !== col.key).slice(0, 2).map((c) => (
                        <Button key={c.key} size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => move.mutate({ id: t.id, status: c.key })}>
                          <ArrowRight className="mr-1 size-3" />{c.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <div className="rounded-lg border border-dashed border-border/40 p-6 text-center text-xs text-muted-foreground">Nothing here</div>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function NewTaskDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuthUser();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [departmentId, setDepartmentId] = useState<string>("");

  const { data: employees } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id,full_name").order("full_name");
      return data ?? [];
    },
  });
  const { data: departments } = useQuery({
    queryKey: ["departments-list"],
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("tasks").insert({
        title,
        description: description || null,
        priority: priority as any,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        assigned_to: assignedTo || null,
        department_id: departmentId || null,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;
      await logActivity("created task", { type: "task", id: data.id, meta: { title } });
      if (assignedTo) {
        await supabase.from("notifications").insert({
          user_id: assignedTo,
          title: "New task assigned",
          body: title,
          category: "task",
          link: "/tasks",
        });
      }
    },
    onSuccess: () => {
      toast.success("Task created");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="glass-strong">
      <DialogHeader><DialogTitle>Create task</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Due date</Label><Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Assignee</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger><SelectValue placeholder="Pick someone" /></SelectTrigger>
              <SelectContent>
                {(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
              <SelectContent>
                {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => create.mutate()} disabled={!title || create.isPending} className="bg-[image:var(--gradient-primary)] text-primary-foreground">Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}
