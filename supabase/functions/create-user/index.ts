// Admin-only: directly create a user with email + password (no email invite),
// set their full name, and assign a role. Useful for adding admins manually.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = [
  "admin",
  "sme",
  "process_manager",
  "process_analyst",
  "senior_manager",
  "user",
] as const;

interface Body {
  email: string;
  password: string;
  full_name?: string;
  role?: (typeof VALID_ROLES)[number];
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin");
    if (!roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ error: "Admin role required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Body;
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";
    const fullName = body.full_name?.trim() || null;
    const role = body.role || "admin";

    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VALID_ROLES.includes(role as any)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user (auto-confirmed so they can sign in immediately)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    let userId = created?.user?.id ?? null;

    if (createErr || !userId) {
      // If user already exists, find them and update password + name
      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = existing?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!found) {
        throw createErr || new Error("Failed to create user");
      }
      userId = found.id;
      const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: fullName ? { full_name: fullName } : undefined,
      });
      if (updErr) throw updErr;
    }

    // Ensure profile row exists / update name
    if (fullName) {
      await admin
        .from("profiles")
        .upsert({ user_id: userId, full_name: fullName }, { onConflict: "user_id" });
    }

    // Assign role
    if (role !== "user") {
      const { error: roleErr } = await admin
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (roleErr) console.error("[create-user] role assign error:", roleErr);
    }

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, email, role }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[create-user] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});