import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("user");
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        toast.success("Account created! Please check your email to verify.");
      } else {
        await signIn(email, password);
        toast.success(activeTab === "admin" ? "Welcome back, Admin!" : "Welcome back!");
      }
      navigate("/chat");
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setFullName("");
    setIsSignUp(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 mb-4 glow-primary">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Banking AI Knowledge</h1>
          <p className="text-muted-foreground text-sm mt-1">Enterprise AI Assistant for Banking Operations</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); resetForm(); }} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-secondary/50 border border-border/50">
            <TabsTrigger value="user" className="flex items-center gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
              <User className="w-4 h-4" />
              User Login
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2 data-[state=active]:bg-accent/20 data-[state=active]:text-accent">
              <Shield className="w-4 h-4" />
              Admin Login
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <div className="glass-panel rounded-2xl p-6 glow-primary">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">Operations Staff</h2>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div className="space-y-2">
                    <Label htmlFor="user-name" className="text-sm text-muted-foreground">Full Name</Label>
                    <Input id="user-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="bg-secondary/50 border-border/50 text-foreground" required />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="user-email" className="text-sm text-muted-foreground">Email</Label>
                  <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@bank.com" className="bg-secondary/50 border-border/50 text-foreground" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-password" className="text-sm text-muted-foreground">Password</Label>
                  <Input id="user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="bg-secondary/50 border-border/50 text-foreground" required minLength={6} />
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-medium">
                  {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                  {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
                </button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="admin">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
