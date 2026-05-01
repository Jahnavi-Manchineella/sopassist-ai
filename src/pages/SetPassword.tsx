import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bot, KeyRound } from "lucide-react";
import { toast } from "sonner";

/**
 * Handles invite + password-recovery links.
 * Supabase appends a recovery/invite token to the URL hash; detectSessionInUrl
 * (enabled by default in the supabase client) will exchange it for a session
 * automatically. We then let the user set a password via updateUser().
 */
export default function SetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Surface explicit errors that Supabase puts in the URL hash
    // (e.g. otp_expired, access_denied) before we wait on a session.
    if (typeof window !== "undefined" && window.location.hash) {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const err = params.get("error_description") || params.get("error");
      if (err) {
        setLinkError(decodeURIComponent(err.replace(/\+/g, " ")));
        return;
      }
    }

    // Supabase invite/recovery links arrive with a token in the URL hash.
    // The supabase client picks it up automatically (detectSessionInUrl), but
    // we listen to onAuthStateChange to react reliably.
    let cancelled = false;
    let timer: number | undefined;

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        setEmail(session.user.email ?? null);
        setReady(true);
      }
    });

    (async () => {
      // First check: maybe the session is already established.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.user) {
        setEmail(data.session.user.email ?? null);
        setReady(true);
        return;
      }
      // If still no session after a short wait, the link is invalid/expired.
      timer = window.setTimeout(async () => {
        if (cancelled) return;
        const { data: again } = await supabase.auth.getSession();
        if (again.session?.user) {
          setEmail(again.session.user.email ?? null);
          setReady(true);
        } else {
          toast.error(
            "Invitation link is invalid or has expired. Ask your admin to resend the invite."
          );
        }
      }, 1500);
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password set. Welcome to SOPAssist AI.");
    // Already signed in — route them based on role.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const list = roles?.map((r) => r.role as string) ?? [];
      if (list.includes("admin")) {
        navigate("/documents");
        return;
      }
      if (list.length > 0) {
        navigate("/tickets");
        return;
      }
    }
    navigate("/chat");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 mb-4 glow-primary">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Set your password</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Activate your SOPAssist AI account
          </p>
        </div>

        <div
          className="glass-panel rounded-2xl p-6 border-accent/20"
          style={{ boxShadow: "0 0 20px hsl(var(--accent) / 0.1)" }}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
            <KeyRound className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-foreground">
              {email ? email : "Activate account"}
            </h2>
          </div>

          {!ready ? (
            linkError ? (
              <div className="space-y-3 py-2">
                <div className="text-sm text-destructive">
                  Your invitation link is no longer valid:
                  <div className="mt-1 text-foreground font-medium">{linkError}</div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Invite links expire for security. Please ask your admin to send
                  a fresh invitation, then click the new link from that email.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/login")}
                >
                  Go to sign in
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground py-4 text-center">
                Verifying your invitation link…
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm text-muted-foreground">
                  New password
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="bg-secondary/50 border-border/50 text-foreground"
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm text-muted-foreground">
                  Confirm password
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="bg-secondary/50 border-border/50 text-foreground"
                  required
                  minLength={8}
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-accent hover:bg-accent/80 text-accent-foreground font-medium"
              >
                {loading ? "Saving…" : "Set password & continue"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}