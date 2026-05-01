// Admin-only: invite a new user by email, generate a Supabase invite link,
// and send a branded invite via Gmail. Optionally assigns admin/sme role.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inviteEmail } from "../_shared/email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  email: string;
  full_name?: string;
  role?: "admin" | "sme" | "user";
}

const APP_URL = "https://sopassist-ai.lovable.app";
const SET_PASSWORD_PATH = "/set-password";

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length <= 254;
}

async function sendViaGmail(to: string, subject: string, html: string, triggeredBy: string | null) {
  const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email-gmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
    },
    body: JSON.stringify({
      to,
      subject,
      html,
      purpose: "invite",
      triggered_by: triggeredBy,
    }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: must be a signed-in admin
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
    const callerEmail = (claimsData.claims.email as string) || null;

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

    // ── Validate body
    const body = (await req.json()) as Body;
    const email = (body.email || "").trim().toLowerCase();
    const fullName = body.full_name?.trim() || null;
    const role = body.role || "user";
    if (!isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["admin", "sme", "user"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate invite link (creates user if not exists; idempotent for existing)
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: `${APP_URL}${SET_PASSWORD_PATH}`,
        data: fullName ? { full_name: fullName } : undefined,
      },
    });

    let inviteUrl: string | null = linkData?.properties?.action_link ?? null;
    let userId: string | null = linkData?.user?.id ?? null;

    // If user already exists, generateLink with type=invite errors → fall back to recovery
    if (linkErr || !inviteUrl) {
      const { data: existing } = await admin.auth.admin.listUsers({
        page: 1, perPage: 200,
      });
      const found = existing?.users?.find((u) => u.email?.toLowerCase() === email);
      if (!found) throw linkErr || new Error("Failed to create invite link");
      userId = found.id;
      const { data: recoverData, error: recoverErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${APP_URL}${SET_PASSWORD_PATH}` },
      });
      if (recoverErr) throw recoverErr;
      inviteUrl = recoverData?.properties?.action_link ?? null;
    }

    if (!inviteUrl || !userId) {
      throw new Error("Could not generate invite link");
    }

    // ── Assign role (admin/sme). Skip "user" — it's the default from handle_new_user.
    if (role !== "user") {
      const { error: roleErr } = await admin
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (roleErr) console.error("[invite-user] role assign error:", roleErr);
    }

    // ── Send branded email via Gmail
    const tpl = inviteEmail({
      fullName,
      role,
      inviteUrl,
      invitedBy: callerEmail,
    });
    await sendViaGmail(email, tpl.subject, tpl.html, callerId);

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, role }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[invite-user] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});