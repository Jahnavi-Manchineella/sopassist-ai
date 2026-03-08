import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const prompt = `Create a professional, clean architecture diagram for a RAG (Retrieval-Augmented Generation) pipeline used in a Banking AI Knowledge Assistant called "SOPAssist AI". 

The diagram should be a horizontal/vertical flowchart with clearly labeled boxes and directional arrows showing data flow. Use a clean, modern style with a white background.

The pipeline flow is:

1. USER QUERY - User enters question in Chat UI
2. AUTHENTICATION - Validate user via Supabase Auth token
3. CATEGORY FILTER - Check if category filter is applied (Compliance, SOP, Products, General)
4. SEARCH_CHUNKS RPC - Full-text search using PostgreSQL tsvector index on document_chunks table, joined with documents table for metadata
5. KEYWORD FALLBACK - If FTS returns no results, extract keywords and run ilike queries on document_chunks
6. CONTEXT BUILDER - Build context string from top 5 retrieved chunks with source metadata
7. CITATION ASSEMBLER - Create citations array with source name, section, content preview, category
8. QUERY CATEGORIZER - Auto-categorize: Compliance, SOP, Products, or General Operations
9. SYSTEM PROMPT CONSTRUCTOR - Combine context, citations instructions, and banking assistant guidelines
10. GROQ LLM API - Send to llama-3.3-70b-versatile model with streaming enabled
11. AUDIT LOGGER - Log query, citations, and category to audit_logs table
12. SSE STREAM - Return Server-Sent Events stream with X-Citations and X-Category headers
13. CHAT UI - Display streamed response with citations and source references

Use boxes with rounded corners. Color-code the sections:
- Blue for user-facing components (Chat UI, User Query)
- Green for retrieval/search components (Search Chunks, Keyword Fallback, Context Builder)
- Orange for AI/LLM components (Groq LLM, System Prompt)
- Purple for data/logging (Audit Logger, Citation Assembler)
- Gray for infrastructure (Auth, SSE Stream)

Add the title "SOPAssist AI - RAG Pipeline Architecture" at the top.
Make the text readable and the layout clean and professional.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const text = data.choices?.[0]?.message?.content || "";

    if (!imageUrl) {
      throw new Error("No image was generated");
    }

    return new Response(JSON.stringify({ imageUrl, text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-diagram error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
