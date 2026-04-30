// Gmail API sender — uses OAuth2 refresh-token flow.
// Refreshes access token on every call (no caching across cold starts).
// Internal helper function: invoked by other edge functions (notify-ticket, invite-user).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendEmailBody {
  to: string;
  subject: string;
  html: string;
  purpose?: string;
  ticket_id?: string | null;
  triggered_by?: string | null;
}

async function getAccessToken(): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing Google OAuth env vars");
  }
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Token refresh failed [${res.status}]: ${txt}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

function base64UrlEncode(str: string): string {
  // UTF-8 safe base64url
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRawMime(from: string, to: string, subject: string, html: string): string {
  // Encode subject as RFC 2047 to support unicode safely
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    html,
  ];
  return base64UrlEncode(lines.join("\r\n"));
}

export async function sendGmail(body: SendEmailBody) {
  const from = Deno.env.get("GMAIL_FROM_ADDRESS") || "SOPAssist AI";
  const accessToken = await getAccessToken();
  const raw = buildRawMime(from, body.to, body.subject, body.html);

  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Gmail send failed [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data as { id: string; threadId: string };
}

async function logEmail(
  body: SendEmailBody,
  status: "sent" | "failed",
  gmailMessageId: string | null,
  error: string | null
) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabase.from("email_logs").insert({
      to_email: body.to,
      subject: body.subject,
      purpose: body.purpose || "other",
      ticket_id: body.ticket_id || null,
      status,
      error,
      gmail_message_id: gmailMessageId,
      triggered_by: body.triggered_by || null,
    });
  } catch (e) {
    console.error("[send-email-gmail] log insert failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const body = (await req.json()) as SendEmailBody;
    if (!body?.to || !body?.subject || !body?.html) {
      return new Response(
        JSON.stringify({ error: "to, subject, html required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    try {
      const result = await sendGmail(body);
      await logEmail(body, "sent", result.id, null);
      return new Response(JSON.stringify({ ok: true, id: result.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      await logEmail(body, "failed", null, e.message);
      throw e;
    }
  } catch (e: any) {
    console.error("[send-email-gmail] error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});