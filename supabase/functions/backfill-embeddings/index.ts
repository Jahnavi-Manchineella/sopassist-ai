import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const HF_KEY = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!HF_KEY) throw new Error("HUGGINGFACE_API_KEY not configured");
  const results: (number[] | null)[] = [];
  const BATCH = 16;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await fetch(
      "https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${HF_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: batch, options: { wait_for_model: true } }),
      }
    );
    if (!res.ok) {
      console.error("HF error:", res.status, await res.text());
      for (const _ of batch) results.push(null);
      continue;
    }
    const data = await res.json();
    for (const v of data) results.push(Array.isArray(v) ? v : null);
  }
  return results;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Admin gate
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Invalid token");
    const { data: roleCheck } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleCheck) throw new Error("Admin access required");

    // Fetch chunks missing embeddings
    const { data: chunks, error } = await supabase
      .from("document_chunks")
      .select("id, content")
      .is("embedding", null)
      .limit(200);
    if (error) throw error;
    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({ updated: 0, message: "All chunks already embedded" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embeddings = await embedTexts(chunks.map((c) => c.content));
    let updated = 0;
    for (let i = 0; i < chunks.length; i++) {
      const emb = embeddings[i];
      if (!emb) continue;
      const { error: upErr } = await supabase
        .from("document_chunks")
        .update({ embedding: JSON.stringify(emb) })
        .eq("id", chunks[i].id);
      if (!upErr) updated++;
    }

    return new Response(
      JSON.stringify({ updated, total: chunks.length, hasMore: chunks.length === 200 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("backfill error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});