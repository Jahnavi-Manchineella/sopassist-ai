import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Event = "created" | "assigned" | "resolved" | "updated";

interface Body {
  event: Event;
  ticket_id: string;
}

const APP_URL = "https://sopassist-ai.lovable.app";

function subjectFor(event: Event, id: string) {
  const short = id.slice(0, 8);
  switch (event) {
    case "created":  return `[SOPAssist] New ticket #${short}`;
    case "assigned": return `[SOPAssist] Ticket #${short} assigned to you`;
    case "resolved": return `[SOPAssist] Your ticket #${short} has been resolved`;
    default:         return `[SOPAssist] Ticket #${short} updated`;
  }
}

function htmlBody(event: Event, ticket: any) {
  const link = `${APP_URL}/tickets`;
  const intro =
    event === "created"  ? "A new support ticket has been raised." :
    event === "assigned" ? "A ticket has been assigned to you." :
    event === "resolved" ? "Your support ticket has been resolved." :
                           "A ticket you are involved with was updated.";
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
      <h2 style="margin:0 0 12px;color:#0f172a;">SOPAssist AI — Ticket Update</h2>
      <p style="margin:0 0 16px;color:#475569;">${intro}</p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;">
        <div style="font-size:12px;color:#64748b;margin-bottom:4px;">Ticket #${ticket.id.slice(0,8)} · ${ticket.category} · ${ticket.priority}</div>
        <div style="font-weight:600;color:#0f172a;margin-bottom:8px;">Status: ${ticket.status.replace("_"," ")}</div>
        <div style="white-space:pre-wrap;color:#1e293b;font-size:14px;">${escapeHtml(ticket.query)}</div>
        ${ticket.resolution_notes ? `<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/><div style="font-size:13px;color:#334155;"><strong>Resolution:</strong><br/>${escapeHtml(ticket.resolution_notes)}</div>` : ""}
      </div>
      <a href="${link}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">Open Ticket</a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8;">SOPAssist AI · Banking Knowledge Assistant</p>
    </div>
  `;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!));
}

async function sendViaResend(to: string[], subject: string, html: string) {
  const RESEND_KEY = Deno.env.get("RESEND_API_KEY");
  const FROM = Deno.env.get("TICKET_FROM_EMAIL") || "SOPAssist <onboarding@resend.dev>";
  if (!RESEND_KEY) {
    console.log("[notify-ticket] RESEND_API_KEY not set — skipping email send to:", to);
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("[notify-ticket] Resend error:", res.status, txt);
    return { error: txt };
  }
  return await res.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.event || !body?.ticket_id) {
      return new Response(JSON.stringify({ error: "event and ticket_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("*")
      .eq("id", body.ticket_id)
      .single();

    if (error || !ticket) {
      return new Response(JSON.stringify({ error: "Ticket not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine recipients
    const recipients = new Set<string>();
    if (body.event === "created") {
      // Notify all admins + SMEs
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "sme"]);
      const ids = (roles || []).map((r: any) => r.user_id);
      for (const id of ids) {
        const { data } = await supabase.auth.admin.getUserById(id);
        if (data?.user?.email) recipients.add(data.user.email);
      }
    } else if (body.event === "assigned" && ticket.assigned_to) {
      const { data } = await supabase.auth.admin.getUserById(ticket.assigned_to);
      if (data?.user?.email) recipients.add(data.user.email);
    } else if (body.event === "resolved" && ticket.user_email) {
      recipients.add(ticket.user_email);
    }

    if (recipients.size === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "no recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendViaResend(
      Array.from(recipients),
      subjectFor(body.event, ticket.id),
      htmlBody(body.event, ticket)
    );

    return new Response(JSON.stringify({ ok: true, recipients: Array.from(recipients), result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-ticket error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});