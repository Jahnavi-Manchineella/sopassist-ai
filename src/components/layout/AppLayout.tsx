import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Bot, MessageSquare, FileText, BarChart3, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = [
    { to: "/chat", icon: MessageSquare, label: "Chat" },
    { to: "/documents", icon: FileText, label: "Documents" },
    ...(isAdmin
      ? [{ to: "/analytics", icon: BarChart3, label: "Analytics" }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav bar */}
      <header className="h-16 border-b border-border flex items-center px-4 gap-4 bg-card/50 backdrop-blur-lg sticky top-0 z-50">
        <Link to="/chat" className="flex items-center gap-2.5 mr-6">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <span className="font-semibold text-foreground text-sm hidden sm:block">Banking AI</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {isAdmin && (
            <span className="text-xs px-2 py-1 rounded-full bg-accent/15 text-accent flex items-center gap-1">
              <Shield className="w-3 h-3" /> Admin
            </span>
          )}
          <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
