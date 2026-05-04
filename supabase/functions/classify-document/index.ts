import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED = ["Compliance", "SOP", "Products", "General Operations"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Admin-only
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roleCheck } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleCheck) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { filename, text } = await req.json();
    const sample = String(text || "").slice(0, 6000);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content:
              "You classify internal banking documents into exactly one knowledge-base domain.\n" +
              "- Compliance: regulations, AML/KYC, audit, GDPR, risk, sanctions.\n" +
              "- SOP: step-by-step procedures, workflows, how-to guides.\n" +
              "- Products: account types, loans, cards, deposits, mortgages, savings.\n" +
              "- General Operations: anything else operational.",
          },
          { role: "user", content: `Filename: ${filename || "unknown"}\n\nDocument excerpt:\n${sample}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "set_category",
            description: "Pick the best-fit domain.",
            parameters: {
              type: "object",
              properties: { category: { type: "string", enum: ALLOWED } },
              required: ["category"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "set_category" } },
      }),
    });

    if (res.status === 429 || res.status === 402) {
      return new Response(JSON.stringify({ error: "AI rate-limited or out of credits", category: "General Operations" }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!res.ok) {
      console.error("classify gateway error", res.status, await res.text());
      return new Response(JSON.stringify({ category: "General Operations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let category = "General Operations";
    if (args) {
      try { const p = JSON.parse(args); if (ALLOWED.includes(p.category)) category = p.category; } catch {}
    }
    return new Response(JSON.stringify({ category }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("classify-document error:", e);
    return new Response(JSON.stringify({ error: e.message, category: "General Operations" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});