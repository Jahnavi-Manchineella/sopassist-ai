import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Shield } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);

      // Verify admin role
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id);
        const hasAdmin = roles?.some((r) => r.role === "admin") ?? false;
        if (!hasAdmin) {
          await supabase.auth.signOut();
          toast.error("Access denied. You do not have administrator privileges.");
          setLoading(false);
          return;
        }
      }

      toast.success("Welcome back, Admin!");
      navigate("/documents");
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 mb-4 glow-primary">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Admin Sign In</h1>
          <p className="text-muted-foreground text-sm mt-1">Administrator access for document management & analytics</p>
        </div>

        <div className="glass-panel rounded-2xl p-6 border-accent/20" style={{ boxShadow: "0 0 20px hsl(var(--accent) / 0.1)" }}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
            <Shield className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">Administrator</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-sm text-muted-foreground">Admin Email</Label>
              <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@bank.com" className="bg-secondary/50 border-border/50 text-foreground" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password" className="text-sm text-muted-foreground">Password</Label>
              <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-secondary/50 border-border/50 text-foreground" required minLength={6} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-accent hover:bg-accent/80 text-accent-foreground font-medium">
              {loading ? "Please wait..." : "Admin Sign In"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            Admin access grants document management & analytics privileges.
          </p>
        </div>
      </div>
    </div>
  );
}
