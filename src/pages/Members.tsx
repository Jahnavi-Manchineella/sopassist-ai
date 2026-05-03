import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, UserCog, Search, RefreshCw, UserPlus, Mail, Trash2, KeyRound } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type AppRole =
  | "admin"
  | "sme"
  | "process_manager"
  | "process_analyst"
  | "senior_manager";

const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "sme", label: "SME" },
  { value: "process_manager", label: "Process Manager" },
  { value: "process_analyst", label: "Process Analyst" },
  { value: "senior_manager", label: "Senior Manager" },
];

const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  sme: "SME",
  process_manager: "Process Manager",
  process_analyst: "Process Analyst",
  senior_manager: "Senior Manager",
};

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
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addRole, setAddRole] = useState<AppRole>("admin");
  const [adding, setAdding] = useState(false);

  // Invite-by-email state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("admin");
  const [inviting, setInviting] = useState(false);

  // Create-with-password state (manual admin creation)
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<AppRole>("admin");
  const [creating, setCreating] = useState(false);

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
      const row =
        map.get(r.user_id) || { user_id: r.user_id, full_name: null, roles: [] };
      // Hide the legacy 'user' role from the UI — only banking ops roles surface.
      if ((ROLE_OPTIONS as { value: string }[]).some((o) => o.value === r.role)) {
        row.roles.push(r.role as AppRole);
      }
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
    process_manager: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    process_analyst: "bg-violet-500/15 text-violet-400 border-violet-500/30",
    senior_manager: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  };

  const removeMember = async (m: MemberRow) => {
    setBusy(m.user_id + ":delete");
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", m.user_id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Removed all roles from ${m.full_name || m.user_id.slice(0, 8)}`
    );
    load();
  };

  const deleteUserPermanently = async (m: MemberRow) => {
    setBusy(m.user_id + ":purge");
    const { data, error } = await supabase.functions.invoke("delete-user", {
      body: { user_id: m.user_id },
    });
    setBusy(null);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to delete user");
      return;
    }
    toast.success(`Deleted ${m.full_name || m.user_id.slice(0, 8)}`);
    load();
  };

  const handleAddMember = async () => {
    const term = addName.trim();
    if (!term) {
      toast.error("Enter a name or user id");
      return;
    }
    setAdding(true);
    // Try exact user_id match first, then partial name match
    let target: MemberRow | undefined = members.find(
      (m) => m.user_id === term
    );
    if (!target) {
      const matches = members.filter((m) =>
        (m.full_name || "").toLowerCase().includes(term.toLowerCase())
      );
      if (matches.length === 0) {
        toast.error("No matching user found. They must sign in at least once.");
        setAdding(false);
        return;
      }
      if (matches.length > 1) {
        toast.error(`Multiple matches (${matches.length}). Refine your search.`);
        setAdding(false);
        return;
      }
      target = matches[0];
    }
    if (target.roles.includes(addRole)) {
      toast.info(`${target.full_name || "User"} is already a ${addRole}`);
      setAdding(false);
      return;
    }
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: target.user_id, role: addRole as any });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(
        `Granted ${addRole} to ${target.full_name || target.user_id.slice(0, 8)}`
      );
      setAddOpen(false);
      setAddName("");
      setAddRole("admin");
      load();
    }
    setAdding(false);
  };

  const handleInviteByEmail = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("invite-user", {
      body: {
        email,
        full_name: inviteName.trim() || undefined,
        role: inviteRole,
      },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to invite user");
      return;
    }
    toast.success(`Invitation sent to ${email}`);
    setInviteOpen(false);
    setInviteEmail("");
    setInviteName("");
    setInviteRole("admin");
    load();
  };

  const handleCreateUser = async () => {
    const email = createEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (createPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email,
        password: createPassword,
        full_name: createName.trim() || undefined,
        role: createRole,
      },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to create user");
      return;
    }
    toast.success(`Created ${email} as ${createRole}`);
    setCreateOpen(false);
    setCreateEmail("");
    setCreatePassword("");
    setCreateName("");
    setCreateRole("admin");
    load();
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
        <div className="flex items-center gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default">
                <KeyRound className="w-4 h-4 mr-2" />
                Create with Password
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create user manually</DialogTitle>
                <DialogDescription>
                  Directly create an account with a password (no email
                  verification). The user can sign in immediately with these
                  credentials.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="create-email">Email address</Label>
                  <Input
                    id="create-email"
                    type="email"
                    placeholder="admin@bank.com"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-password">Password (min 8 chars)</Label>
                  <Input
                    id="create-password"
                    type="text"
                    placeholder="Strong password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-name">Full name</Label>
                  <Input
                    id="create-name"
                    placeholder="Jane Doe"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={createRole}
                    onValueChange={(v) => setCreateRole(v as AppRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating ? "Creating…" : "Create user"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Mail className="w-4 h-4 mr-2" />
                Invite by Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a new member</DialogTitle>
                <DialogDescription>
                  An invitation email will be sent with a secure link to set their
                  password. The selected role is granted on account activation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="person@bank.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-name">Full name (optional)</Label>
                  <Input
                    id="invite-name"
                    placeholder="Jane Doe"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as AppRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                  disabled={inviting}
                >
                  Cancel
                </Button>
                <Button onClick={handleInviteByEmail} disabled={inviting}>
                  {inviting ? "Sending…" : "Send invite"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="w-4 h-4 mr-2" />
                Grant Existing User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add member role</DialogTitle>
                <DialogDescription>
                  Grant admin or SME role to an existing user. The user must
                  have signed in at least once.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="member-search">User name or ID</Label>
                  <Input
                    id="member-search"
                    placeholder="e.g. Jane Doe or user uuid"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={addRole}
                    onValueChange={(v) => setAddRole(v as AppRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddOpen(false)}
                  disabled={adding}
                >
                  Cancel
                </Button>
                <Button onClick={handleAddMember} disabled={adding}>
                  {adding ? "Adding…" : "Grant role"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw
              className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
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
                    {ROLE_LABEL[r]}
                  </Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-1 font-mono">
                {m.user_id}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {ROLE_OPTIONS.map(({ value: role, label }) => {
                const has = m.roles.includes(role);
                return (
                  <Button
                    key={role}
                    size="sm"
                    variant={has ? "destructive" : "outline"}
                    disabled={busy === m.user_id + role}
                    onClick={() => toggleRole(m, role)}
                  >
                    {has ? `Remove ${label}` : `Make ${label}`}
                  </Button>
                );
              })}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy === m.user_id + ":delete"}
                    title="Remove all roles for this member"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Remove roles
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove member access?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This revokes all roles from{" "}
                      <strong>{m.full_name || m.user_id.slice(0, 8)}</strong>.
                      They will no longer be able to access staff areas of the
                      app. Their account record is preserved for audit
                      history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeMember(m)}>
                      Remove access
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy === m.user_id + ":purge"}
                    title="Permanently delete this user account"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete user
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Permanently delete user?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes{" "}
                      <strong>{m.full_name || m.user_id.slice(0, 8)}</strong> —
                      their auth account, profile, and roles will be removed.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteUserPermanently(m)}>
                      Delete permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}