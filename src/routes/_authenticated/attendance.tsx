import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyRole, logActivity } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIST, formatISTDate, formatISTTime, todayISTDate } from "@/lib/ist";
import { CalendarCheck, LogIn, LogOut, Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance — Pulseboard" }] }),
  component: AttendancePage,
});

function AttendancePage() {
  const { user } = useAuthUser();
  const { data: role } = useMyRole();
  const isManager = role === "manager" || role === "admin";
  const qc = useQueryClient();
  const today = todayISTDate();

  const { data: mine } = useQuery({
    queryKey: ["att-today", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("*").eq("user_id", user!.id).eq("date", today).maybeSingle();
      return data;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["att-history", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("attendance").select("*").eq("user_id", user!.id).order("date", { ascending: false }).limit(30)).data ?? [],
  });

  const { data: team } = useQuery({
    queryKey: ["att-team", today],
    enabled: isManager,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("*, profile:user_id(full_name,photo_url,designation)")
        .eq("date", today)
        .order("check_in", { ascending: false });
      return data ?? [];
    },
  });

  const checkIn = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const istHour = +new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(now);
      const status = istHour >= 10 ? "late" : "present";
      const { error } = await supabase.from("attendance").upsert({
        user_id: user!.id, date: today, check_in: now.toISOString(), status,
      }, { onConflict: "user_id,date" });
      if (error) throw error;
      await logActivity("checked in", { type: "attendance" });
    },
    onSuccess: () => { toast.success("Checked in"); qc.invalidateQueries({ queryKey: ["att-today"] }); qc.invalidateQueries({ queryKey: ["att-history"] }); qc.invalidateQueries({ queryKey: ["att-team"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const checkOut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("attendance").update({ check_out: new Date().toISOString() }).eq("user_id", user!.id).eq("date", today);
      if (error) throw error;
      await logActivity("checked out", { type: "attendance" });
    },
    onSuccess: () => { toast.success("Checked out"); qc.invalidateQueries({ queryKey: ["att-today"] }); qc.invalidateQueries({ queryKey: ["att-history"] }); qc.invalidateQueries({ queryKey: ["att-team"] }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">All times shown in Indian Standard Time.</p>
      </div>

      <Card className="glass">
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarCheck className="size-4" /> Today • {formatISTDate(new Date())}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Info label="Status" value={<Badge variant="outline" className="capitalize">{mine?.status ?? "Not checked in"}</Badge>} />
            <Info label="Check in" value={formatISTTime(mine?.check_in)} />
            <Info label="Check out" value={formatISTTime(mine?.check_out)} />
            <div className="flex items-end gap-2">
              {!mine?.check_in ? (
                <Button onClick={() => checkIn.mutate()} className="bg-[image:var(--gradient-primary)] text-primary-foreground"><LogIn className="mr-1 size-4" /> Check in</Button>
              ) : !mine?.check_out ? (
                <Button onClick={() => checkOut.mutate()} variant="outline"><LogOut className="mr-1 size-4" /> Check out</Button>
              ) : (
                <Badge className="bg-success/20 text-success">Day complete</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {isManager && (
        <Card className="glass">
          <CardHeader><CardTitle>Today's team attendance</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Employee</TableHead><TableHead>Status</TableHead><TableHead>Check in</TableHead><TableHead>Check out</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {(team ?? []).map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.profile?.full_name ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{t.status}</Badge></TableCell>
                    <TableCell>{formatISTTime(t.check_in)}</TableCell>
                    <TableCell>{formatISTTime(t.check_out)}</TableCell>
                  </TableRow>
                ))}
                {(team ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nobody checked in yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card className="glass">
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-4" /> My last 30 days</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Check in</TableHead><TableHead>Check out</TableHead></TableRow></TableHeader>
            <TableBody>
              {(history ?? []).map((h: any) => (
                <TableRow key={h.id}>
                  <TableCell>{h.date}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{h.status}</Badge></TableCell>
                  <TableCell>{formatIST(h.check_in)}</TableCell>
                  <TableCell>{formatIST(h.check_out)}</TableCell>
                </TableRow>
              ))}
              {(history ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No history yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-medium">{value}</div>
    </div>
  );
}
