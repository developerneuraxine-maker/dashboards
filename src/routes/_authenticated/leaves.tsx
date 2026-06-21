import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyRole, logActivity } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatISTDate } from "@/lib/ist";
import { Plus, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({ meta: [{ title: "Leaves — Pulseboard" }] }),
  component: LeavesPage,
});

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-warning/20 text-warning",
  approved: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
  changes_requested: "bg-primary/20 text-primary",
};

function LeavesPage() {
  const { user } = useAuthUser();
  const { data: role } = useMyRole();
  const isManager = role === "manager" || role === "admin";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: list } = useQuery({
    queryKey: ["leaves", user?.id, role],
    enabled: !!user,
    queryFn: async () => (await supabase.from("leaves").select("*, profile:user_id(full_name)").order("created_at", { ascending: false })).data ?? [],
  });

  const review = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" | "changes_requested" }) => {
      const { error } = await supabase.from("leaves").update({ status, reviewed_by: user!.id }).eq("id", id);
      if (error) throw error;
      const row = (list ?? []).find((l: any) => l.id === id) as any;
      if (row) {
        await supabase.from("notifications").insert({
          user_id: row.user_id,
          title: `Leave ${status.replace("_", " ")}`,
          body: `Your ${row.type} leave was ${status.replace("_", " ")}.`,
          category: "leave",
          link: "/leaves",
        });
      }
      await logActivity(`leave ${status}`, { type: "leave", id });
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["leaves"] }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Leave</h1>
          <p className="text-sm text-muted-foreground">Apply for and manage leave requests.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="bg-[image:var(--gradient-primary)] text-primary-foreground"><Plus className="mr-1 size-4" />Apply</Button></DialogTrigger>
          <ApplyLeave onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <Card className="glass">
        <CardHeader><CardTitle>{isManager ? "All requests" : "My requests"}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              {isManager && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead>{isManager && <TableHead></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {(list ?? []).map((l: any) => (
                <TableRow key={l.id}>
                  {isManager && <TableCell className="font-medium">{l.profile?.full_name ?? "—"}</TableCell>}
                  <TableCell className="capitalize">{l.type}</TableCell>
                  <TableCell>{formatISTDate(l.start_date)} → {formatISTDate(l.end_date)}</TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground">{l.reason}</TableCell>
                  <TableCell><Badge className={STATUS_COLOR[l.status]}>{l.status.replace("_", " ")}</Badge></TableCell>
                  {isManager && (
                    <TableCell className="space-x-1">
                      {l.status === "pending" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => review.mutate({ id: l.id, status: "approved" })}><Check className="size-4 text-success" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => review.mutate({ id: l.id, status: "rejected" })}><X className="size-4 text-destructive" /></Button>
                        </>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {(list ?? []).length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No requests yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ApplyLeave({ onClose }: { onClose: () => void }) {
  const { user } = useAuthUser();
  const qc = useQueryClient();
  const [type, setType] = useState("casual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const submit = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leaves").insert({ user_id: user!.id, type: type as any, start_date: startDate, end_date: endDate, reason });
      if (error) throw error;
      await logActivity("applied for leave", { type: "leave" });
    },
    onSuccess: () => { toast.success("Submitted"); qc.invalidateQueries({ queryKey: ["leaves"] }); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="glass-strong">
      <DialogHeader><DialogTitle>Apply for leave</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="sick">Sick</SelectItem>
              <SelectItem value="emergency">Emergency</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>From</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>To</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button disabled={!startDate || !endDate} onClick={() => submit.mutate()} className="bg-[image:var(--gradient-primary)] text-primary-foreground">Submit</Button>
      </DialogFooter>
    </DialogContent>
  );
}
