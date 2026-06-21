import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Calendar as CalIcon,
  Clock,
  FileText,
  Users,
  BarChart3,
  Bell,
  UserCircle,
  Activity,
  PlaneTakeoff,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useMyProfile, useMyRole } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/attendance", label: "Attendance", icon: CalIcon },
  { to: "/time", label: "Time Tracker", icon: Clock },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/leaves", label: "Leaves", icon: PlaneTakeoff },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: UserCircle },
] as const;

const managerNav = [
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/activity", label: "Activity Log", icon: Activity },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: profile } = useMyProfile();
  const { data: role } = useMyRole();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const isActive = (p: string) => path === p || path.startsWith(p + "/");

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon" className="glass-strong border-r border-sidebar-border">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="size-8 shrink-0 rounded-lg bg-[image:var(--gradient-primary)] shadow-[var(--shadow-glow)]" />
          <div className="overflow-hidden group-data-[collapsible=icon]:hidden">
            <div className="text-sm font-semibold tracking-tight">Pulseboard</div>
            <div className="truncate text-xs capitalize text-muted-foreground">{role ?? "..."} workspace</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {baseNav.map((it) => (
                <SidebarMenuItem key={it.to}>
                  <SidebarMenuButton asChild isActive={isActive(it.to)} tooltip={it.label}>
                    <Link to={it.to}>
                      <it.icon className="size-4" />
                      <span>{it.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(role === "manager" || role === "admin") && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managerNav.map((it) => (
                  <SidebarMenuItem key={it.to}>
                    <SidebarMenuButton asChild isActive={isActive(it.to)} tooltip={it.label}>
                      <Link to={it.to}>
                        <it.icon className="size-4" />
                        <span>{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center gap-2 px-2 py-2">
          <Avatar className="size-8">
            <AvatarImage src={profile?.photo_url ?? undefined} />
            <AvatarFallback>{(profile?.full_name ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 overflow-hidden group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-medium">{profile?.full_name ?? "User"}</div>
            <div className="truncate text-xs text-muted-foreground">{profile?.email}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={signOut} className="group-data-[collapsible=icon]:hidden">
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
