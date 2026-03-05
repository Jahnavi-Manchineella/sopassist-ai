import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Invalid token");

    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) throw new Error("Admin access required");

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const category = (formData.get("category") as string) || "General Operations";
    const parentDocId = formData.get("parent_document_id") as string | null;
    const version = parseInt((formData.get("version") as string) || "1", 10);

    if (!file) throw new Error("No file provided");

    const fileName = file.name;
    const fileExt = fileName.split(".").pop()?.toLowerCase() || "";

    if (!["pdf", "docx", "txt"].includes(fileExt)) {
      throw new Error("Unsupported file type. Use PDF, DOCX, or TXT.");
    }

    let extractedText = "";

    if (fileExt === "txt") {
      extractedText = await file.text();
    } else {
      // For PDF and DOCX, use Lovable AI to extract text from the file
      // First, read the file as base64
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const mimeType = fileExt === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      // Use Gemini's multimodal capability to extract text from the document
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a document text extraction tool. Extract ALL text content from the provided document exactly as it appears. Preserve paragraph structure using double newlines between paragraphs. Preserve section headings. Do NOT summarize, interpret, or add commentary. Output ONLY the extracted text.",
            },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64}`,
                  },
                },
                {
                  type: "text",
                  text: "Extract all text content from this document. Preserve the structure with section headings and paragraphs.",
                },
              ],
            },
          ],
          max_tokens: 16000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI extraction error:", aiResponse.status, errText);
        throw new Error(`Failed to extract text from ${fileExt.toUpperCase()} file. AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      extractedText = aiData.choices?.[0]?.message?.content || "";

      if (!extractedText.trim()) {
        throw new Error("No text could be extracted from the document");
      }
    }

    // Upload original file to storage
    const storagePath = `${user.id}/${Date.now()}_${fileName}`;
    await supabase.storage.from("documents").upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

    // Insert document record
    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        name: fileName,
        file_type: fileExt,
        category,
        content: extractedText,
        uploaded_by: user.id,
        version,
        is_latest: true,
        parent_document_id: parentDocId,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Chunk the document by paragraphs
    const paragraphs = extractedText.split(/\n\n+/).filter((p: string) => p.trim().length > 30);
    const chunks = paragraphs.map((p: string, i: number) => {
      const firstLine = p.split("\n")[0];
      const isTitle = firstLine.length < 100 && !firstLine.endsWith(".");
      return {
        document_id: doc.id,
        chunk_index: i,
        content: p.trim(),
        section_title: isTitle ? firstLine.trim() : null,
      };
    });

    if (chunks.length > 0) {
      const { error: chunkErr } = await supabase.from("document_chunks").insert(chunks);
      if (chunkErr) console.error("Chunk insert error:", chunkErr);
    }

    return new Response(
      JSON.stringify({
        id: doc.id,
        name: fileName,
        chunks: chunks.length,
        textLength: extractedText.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e: any) {
    console.error("parse-document error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
