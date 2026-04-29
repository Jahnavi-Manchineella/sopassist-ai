import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, UserCog, Search, RefreshCw } from "lucide-react";

type AppRole = "admin" | "sme" | "user";

interface MemberRow {
  user_id: string;
  full_name: string | null;
  roles: AppRole[];
}

export default function Members() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const map = new Map<string, MemberRow>();
    (profiles || []).forEach((p) =>
      map.set(p.user_id, { user_id: p.user_id, full_name: p.full_name, roles: [] })
    );
    (roles || []).forEach((r) => {
      const row = map.get(r.user_id) || { user_id: r.user_id, full_name: null, roles: [] };
      row.roles.push(r.role as AppRole);
      map.set(r.user_id, row);
    });
    setMembers(Array.from(map.values()));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter(
      (m) =>
        (m.full_name || "").toLowerCase().includes(t) ||
        m.user_id.toLowerCase().includes(t)
    );
  }, [members, q]);

  const toggleRole = async (m: MemberRow, role: AppRole) => {
    setBusy(m.user_id + role);
    const has = m.roles.includes(role);
    if (has) {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", m.user_id)
        .eq("role", role as any);
      if (error) toast.error(error.message);
      else toast.success(`Removed ${role} from ${m.full_name || m.user_id.slice(0, 8)}`);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: m.user_id, role: role as any });
      if (error) toast.error(error.message);
      else toast.success(`Granted ${role} to ${m.full_name || m.user_id.slice(0, 8)}`);
    }
    setBusy(null);
    load();
  };

  const ROLE_STYLE: Record<AppRole, string> = {
    admin: "bg-accent/15 text-accent border-accent/30",
    sme: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    user: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <UserCog className="w-6 h-6 text-primary" />
            Member Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Grant or revoke admin and SME roles. Only admins can manage members.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or user id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="space-y-2">
        {loading && <div className="text-sm text-muted-foreground p-8 text-center">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="glass-panel rounded-lg p-12 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        )}
        {filtered.map((m) => (
          <div
            key={m.user_id}
            className="glass-panel rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">
                  {m.full_name || "Unnamed user"}
                </span>
                {m.roles.map((r) => (
                  <Badge key={r} variant="outline" className={ROLE_STYLE[r]}>
                    {r === "admin" && <Shield className="w-3 h-3 mr-1" />}
                    {r}
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {m.user_id}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(["admin", "sme"] as AppRole[]).map((role) => {
                const has = m.roles.includes(role);
                return (
                  <Button
                    key={role}
                    size="sm"
                    variant={has ? "destructive" : "outline"}
                    disabled={busy === m.user_id + role}
                    onClick={() => toggleRole(m, role)}
                  >
                    {has ? `Remove ${role}` : `Make ${role}`}
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}