import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Expose-Headers": "X-Citations, X-Category",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversationId, category: userCategory } = await req.json();
    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Identify user from auth header
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const lastUserMessage = messages[messages.length - 1]?.content || "";

    // Use full-text search via the search_chunks function
    let relevantChunks: any[] = [];
    const categoryFilter = userCategory && userCategory !== "All" ? userCategory : null;

    const { data: chunks, error: searchError } = await supabase.rpc("search_chunks", {
      query_text: lastUserMessage,
      category_filter: categoryFilter,
      match_limit: 5,
    });

    if (searchError) {
      console.error("search_chunks error:", searchError);
    }
    relevantChunks = chunks || [];

    // If full-text search returns nothing, fall back to keyword ilike
    if (relevantChunks.length === 0) {
      const stopWords = new Set(["the", "is", "at", "which", "on", "a", "an", "and", "or", "but", "in", "to", "for", "of", "with", "what", "how", "does", "are", "can", "do", "this", "that", "from", "about"]);
      const keywords = lastUserMessage
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length > 2 && !stopWords.has(w))
        .slice(0, 6);

      if (keywords.length > 0) {
        const orFilter = keywords.map((k: string) => `content.ilike.%${k}%`).join(",");
        let query = supabase
          .from("document_chunks")
          .select("content, section_title, document_id, documents(name, category)")
          .or(orFilter)
          .limit(5);

        const { data: fallbackChunks } = await query;
        relevantChunks = (fallbackChunks || []).map((c: any) => ({
          chunk_content: c.content,
          chunk_section_title: c.section_title,
          chunk_document_id: c.document_id,
          doc_name: c.documents?.name || "Unknown",
          doc_category: c.documents?.category || "General Operations",
        }));
      }
    }

    // Build context and citations
    let contextStr = "";
    const citations: any[] = [];
    if (relevantChunks.length > 0) {
      contextStr = "\n\nRelevant document excerpts:\n";
      relevantChunks.forEach((chunk: any, i: number) => {
        const docName = chunk.doc_name || "Unknown";
        const docCat = chunk.doc_category || "General Operations";
        const section = chunk.chunk_section_title || "General";
        const content = chunk.chunk_content || chunk.content || "";
        contextStr += `\n[Source ${i + 1}: ${docName}, Section: ${section}]\n${content}\n`;
        citations.push({
          source: docName,
          section,
          content: content.substring(0, 200),
          category: docCat,
        });
      });
    }

    // Categorize query
    let category = userCategory && userCategory !== "All" ? userCategory : "General Operations";
    if (category === "General Operations") {
      const lowerQuery = lastUserMessage.toLowerCase();
      if (/compliance|regulation|policy|aml|kyc|audit|gdpr/.test(lowerQuery)) category = "Compliance";
      else if (/procedure|process|step|sop|how to|workflow/.test(lowerQuery)) category = "SOP";
      else if (/product|account|loan|card|deposit|mortgage|savings/.test(lowerQuery)) category = "Products";
    }

    const systemPrompt = `You are a Banking AI Knowledge Assistant for internal banking operations teams. You help answer questions about banking procedures, compliance, products, and operations based on internal documents.

${contextStr ? `Use the following document excerpts to ground your answer. Always cite your sources using [Source N] notation when referencing information from the documents.${contextStr}` : "No relevant documents found in the knowledge base. Answer based on your general banking knowledge but clearly state that no internal documents were found matching the query."}

Guidelines:
- Be professional, accurate, and concise
- Always cite sources when available using [Source N] format
- If information is not in the provided documents, say so clearly
- Structure responses with clear headings and bullet points when appropriate
- Focus on actionable, practical answers for banking operations teams
- You are informational only - never suggest taking automated actions`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
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
      const t = await aiResponse.text();
      console.error("AI gateway error:", status, t);
      throw new Error(`AI gateway error: ${status}`);
    }

    // Log audit entry
    if (userId) {
      await supabase.from("audit_logs").insert({
        user_id: userId,
        query: lastUserMessage,
        retrieved_chunks: citations,
        category,
      });
    }

    // Return stream with citation headers
    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "text/event-stream");
    headers.set("X-Citations", JSON.stringify(citations));
    headers.set("X-Category", category);

    return new Response(aiResponse.body, { headers });
  } catch (e: any) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
