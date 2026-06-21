import { type ReactNode, useEffect, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { formatIST } from "@/lib/ist";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function NotificationsBell() {
  const { user } = useAuthUser();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["notif-count", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      return count ?? 0;
    },
  });
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("notif-bell")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["notif-count", user.id] });
        qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);
  return (
    <Link to="/notifications">
      <Button variant="ghost" size="icon" className="relative">
        <Bell className="size-5" />
        {(data ?? 0) > 0 && (
          <span className="absolute right-1 top-1 inline-flex size-2 rounded-full bg-destructive" />
        )}
      </Button>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const now = useNow();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="glass sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-border/40 px-3 md:px-6">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="hidden text-xs text-muted-foreground md:inline">{formatIST(now)}</span>
            </div>
            <div className="flex items-center gap-1">
              <NotificationsBell />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
      <Toaster richColors theme="dark" position="top-right" />
    </SidebarProvider>
  );
}
