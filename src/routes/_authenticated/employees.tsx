import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyRole, useAuthUser } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [{ title: "Employees — Pulseboard" }] }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { data: role } = useMyRole();
  const { user } = useAuthUser();
  const qc = useQueryClient();

  const { data: employees } = useQuery({
    queryKey: ["all-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*, departments(name), user_roles(role)")
        .order("full_name");
      return data ?? [];
    },
  });
  const { data: departments } = useQuery({
    queryKey: ["all-departments"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const updateDept = useMutation({
    mutationFn: async ({ userId, departmentId }: { userId: string; departmentId: string }) => {
      const { error } = await supabase.from("profiles").update({ department_id: departmentId || null }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["all-employees"] }); },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "manager" | "employee" }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["all-employees"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (role !== "admin" && role !== "manager") {
    return <div className="rounded-xl border border-border/40 p-8 text-center text-muted-foreground">Managers and admins only.</div>;
  }
  const isAdmin = role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
        <p className="text-sm text-muted-foreground"><Users className="mr-1 inline size-4" />{employees?.length ?? 0} people in your workspace.</p>
      </div>

      <Card className="glass">
        <CardHeader><CardTitle>Directory</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Department</TableHead><TableHead>Designation</TableHead><TableHead>Joined</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(employees ?? []).map((p: any) => {
                const myRole = (p.user_roles?.[0]?.role ?? "employee") as "admin" | "manager" | "employee";
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8"><AvatarImage src={p.photo_url ?? undefined} /><AvatarFallback>{p.full_name?.slice(0, 1)}</AvatarFallback></Avatar>
                        <div><div className="font-medium">{p.full_name}</div><div className="text-xs text-muted-foreground">{p.email}</div></div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {isAdmin && p.id !== user?.id ? (
                        <Select defaultValue={myRole} onValueChange={(v: any) => updateRole.mutate({ userId: p.id, newRole: v })}>
                          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem><SelectItem value="manager">Manager</SelectItem><SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : <Badge variant="outline" className="capitalize">{myRole}</Badge>}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Select defaultValue={p.department_id ?? ""} onValueChange={(v) => updateDept.mutate({ userId: p.id, departmentId: v })}>
                          <SelectTrigger className="w-44"><SelectValue placeholder="—" /></SelectTrigger>
                          <SelectContent>
                            {(departments ?? []).map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (p.departments?.name ?? "—")}
                    </TableCell>
                    <TableCell>{p.designation ?? "—"}</TableCell>
                    <TableCell>{p.joining_date ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
