import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useMyProfile } from "@/lib/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatISTDate, formatDuration } from "@/lib/ist";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — Pulseboard" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuthUser();
  const { data: profile } = useMyProfile();
  const qc = useQueryClient();
  const [fullName, setName] = useState("");
  const [designation, setDes] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [photo, setPhoto] = useState("");

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setDes(profile.designation ?? "");
      setPhone(profile.phone ?? "");
      setBio(profile.bio ?? "");
      setPhoto(profile.photo_url ?? "");
    }
  }, [profile]);

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [tasks, att, sessions] = await Promise.all([
        supabase.from("tasks").select("status").eq("assigned_to", user!.id),
        supabase.from("attendance").select("status").eq("user_id", user!.id),
        supabase.from("time_sessions").select("started_at,ended_at,paused_seconds").eq("user_id", user!.id),
      ]);
      const t = (tasks.data ?? []) as { status: string }[];
      const a = (att.data ?? []) as { status: string }[];
      const totalSec = (sessions.data ?? []).reduce((acc, s: any) => {
        const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
        return acc + Math.max(0, Math.floor((end - new Date(s.started_at).getTime()) / 1000) - (s.paused_seconds ?? 0));
      }, 0);
      const present = a.filter((r) => r.status !== "absent").length;
      return {
        completed: t.filter((x) => x.status === "completed").length,
        total: t.length,
        attendancePct: a.length ? Math.round((present / a.length) * 100) : 0,
        totalSec,
      };
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ full_name: fullName, designation, phone, bio, photo_url: photo }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="glass lg:col-span-1">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <Avatar className="size-24"><AvatarImage src={photo} /><AvatarFallback className="text-2xl">{fullName.slice(0, 1)}</AvatarFallback></Avatar>
          <div>
            <div className="text-xl font-semibold">{fullName || "—"}</div>
            <div className="text-sm text-muted-foreground">{designation || "—"}</div>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <Badge variant="outline">{(profile as any)?.departments?.name ?? "No department"}</Badge>
            <Badge variant="outline">Joined {formatISTDate(profile?.joining_date as any)}</Badge>
          </div>

          <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
            <KPI label="Tasks done" v={String(stats?.completed ?? 0)} />
            <KPI label="Attendance" v={`${stats?.attendancePct ?? 0}%`} />
            <KPI label="Hours" v={formatDuration(stats?.totalSec ?? 0)} />
          </div>
        </CardContent>
      </Card>

      <Card className="glass lg:col-span-2">
        <CardHeader><CardTitle>Edit profile</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Full name</Label><Input value={fullName} onChange={(e) => setName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Designation</Label><Input value={designation} onChange={(e) => setDes(e.target.value)} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
            <div className="space-y-1"><Label>Photo URL</Label><Input value={photo} onChange={(e) => setPhoto(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} /></div>
          <Button onClick={() => save.mutate()} className="bg-[image:var(--gradient-primary)] text-primary-foreground">Save changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, v }: { label: string; v: string }) {
  return <div className="rounded-lg bg-background/40 p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-lg font-semibold">{v}</div></div>;
}
