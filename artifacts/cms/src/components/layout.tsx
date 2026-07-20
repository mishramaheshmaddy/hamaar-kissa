import { LayoutDashboard, Library, Music, Video as VideoIcon, LogOut, LayoutGrid, Users as UsersIcon, UploadCloud, Bell } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { email, logout } = useAuth();

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/home-screen", label: "Home Screen", icon: LayoutGrid },
    { href: "/categories", label: "Categories", icon: Library },
    { href: "/audio-stories", label: "Audio Stories", icon: Music },
    { href: "/videos", label: "Videos", icon: VideoIcon },
    { href: "/bulk-upload", label: "Bulk Upload", icon: UploadCloud },
    { href: "/user-submissions", label: "User Submissions", icon: UsersIcon },
    { href: "/notifications", label: "Notifications", icon: Bell },
  ];

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <h1 className="text-xl font-bold text-primary flex items-center gap-2">
            <span className="bg-primary text-white p-1 rounded">HK</span>
            Hamaar Kissa
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Admin Control Room</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {links.map((link) => {
            const isActive = location === link.href || (link.href !== "/" && location.startsWith(link.href));
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t">
          <div className="text-xs text-muted-foreground mb-2 truncate px-1">{email}</div>
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={logout}>
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
