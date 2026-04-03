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

    const body = await req.json();
    const { url, category = "General Operations", parent_document_id, version = 1 } = body;

    if (!url || typeof url !== "string") {
      throw new Error("A valid URL is required");
    }

    // Validate it looks like a SharePoint or OneDrive URL
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const isSharePoint = hostname.includes("sharepoint.com") || 
                         hostname.includes("sharepoint-df.com") ||
                         hostname.includes("onedrive.com") ||
                         hostname.includes("1drv.ms") ||
                         hostname.includes("office.com") ||
                         hostname.includes("microsoft.com");

    if (!isSharePoint) {
      throw new Error("URL must be a SharePoint, OneDrive, or Microsoft 365 link");
    }

    // Transform SharePoint sharing URLs to direct download URLs
    let downloadUrl = url;
    
    // Handle :x:/r/ or :x:/s/ style sharing links  
    // e.g. https://xxx.sharepoint.com/:w:/s/site/ENCODED_ID
    const sharingMatch = url.match(/sharepoint\.com\/:([a-z]):\//);
    if (sharingMatch) {
      // Convert sharing link to download by appending download=1
      downloadUrl = url.includes("?") ? `${url}&download=1` : `${url}?download=1`;
    }

    // Handle /_layouts/15/download.aspx style
    if (url.includes("/_layouts/15/Doc.aspx") || url.includes("/_layouts/15/WopiFrame.aspx")) {
      downloadUrl = url.replace(/\/_layouts\/15\/(Doc|WopiFrame)\.aspx/, "/_layouts/15/download.aspx");
    }

    // Handle direct file links in document libraries
    // e.g. /sites/team/Shared Documents/file.pdf
    if (url.includes("/Shared%20Documents/") || url.includes("/Shared Documents/")) {
      downloadUrl = url;
    }

    // Guess file type from URL
    const urlPath = parsedUrl.pathname.toLowerCase();
    let detectedExt = "";
    const extMatch = urlPath.match(/\.(\w+)(?:\?|$)/);
    if (extMatch) {
      detectedExt = extMatch[1];
    } else if (sharingMatch) {
      // SharePoint type codes: w=word, x=excel, p=powerpoint, b=pdf, o=onenote, u=generic
      const typeMap: Record<string, string> = { w: "docx", x: "xlsx", p: "pptx", b: "pdf", o: "one", u: "" };
      detectedExt = typeMap[sharingMatch[1]] || "";
    }

    // Determine a file name
    let fileName = "SharePoint Document";
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.includes(".")) {
      fileName = decodeURIComponent(lastPart);
    } else if (detectedExt) {
      fileName = `SharePoint Document.${detectedExt}`;
    }

    console.log("Fetching SharePoint URL:", downloadUrl);
    console.log("Detected extension:", detectedExt);
    console.log("File name:", fileName);

    // Try to fetch the document content
    let fileBytes: Uint8Array;
    let contentType = "application/octet-stream";
    
    try {
      const fetchRes = await fetch(downloadUrl, {
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!fetchRes.ok) {
        // If direct download fails, try to extract content from HTML page
        if (fetchRes.status === 403 || fetchRes.status === 401) {
          throw new Error(
            "Access denied. The SharePoint link must be set to 'Anyone with the link can view'. " +
            "Please update sharing permissions and try again."
          );
        }
        throw new Error(`Failed to fetch document: HTTP ${fetchRes.status}`);
      }

      contentType = fetchRes.headers.get("content-type") || contentType;
      const arrayBuf = await fetchRes.arrayBuffer();
      fileBytes = new Uint8Array(arrayBuf);

      // If we got HTML back instead of a file, it's likely a sharing page
      if (contentType.includes("text/html") && fileBytes.length < 500000) {
        const htmlText = new TextDecoder().decode(fileBytes);
        
        // Try to extract the actual download URL from the HTML
        const directUrlMatch = htmlText.match(/https?:\/\/[^"'\s]+\.(?:pdf|docx|xlsx|pptx|txt|csv)[^"'\s]*/i);
        if (directUrlMatch) {
          console.log("Found direct URL in HTML:", directUrlMatch[0]);
          const retryRes = await fetch(directUrlMatch[0], { redirect: "follow" });
          if (retryRes.ok) {
            contentType = retryRes.headers.get("content-type") || contentType;
            const retryBuf = await retryRes.arrayBuffer();
            fileBytes = new Uint8Array(retryBuf);
          }
        } else {
          // Use AI to extract whatever text content is visible on the page
          console.log("Got HTML page, extracting text content via AI");
        }
      }
    } catch (fetchErr: any) {
      if (fetchErr.message.includes("Access denied")) throw fetchErr;
      throw new Error(`Could not download from SharePoint: ${fetchErr.message}. Ensure the link is publicly accessible.`);
    }

    // Determine if content is text-based or binary
    let extractedText = "";
    const isTextContent = contentType.includes("text/plain") || 
                          contentType.includes("text/csv") ||
                          detectedExt === "txt" || 
                          detectedExt === "csv";

    if (isTextContent) {
      extractedText = new TextDecoder().decode(fileBytes);
      if (detectedExt === "csv") {
        extractedText = `CSV Data: ${fileName}\n\n${extractedText}`;
      }
    } else {
      // Use AI multimodal extraction for binary content
      let binary = "";
      for (let i = 0; i < fileBytes.length; i++) {
        binary += String.fromCharCode(fileBytes[i]);
      }
      const base64 = btoa(binary);

      const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
      };
      const mimeType = mimeMap[detectedExt] || contentType || "application/octet-stream";

      let systemPrompt = "You are a document text extraction tool. Extract ALL text content from the provided document exactly as it appears. Preserve paragraph structure using double newlines between paragraphs. Preserve section headings. Do NOT summarize, interpret, or add commentary. Output ONLY the extracted text.";
      let userPrompt = "Extract all text content from this document. Preserve the structure with section headings and paragraphs.";

      if (["xlsx", "xls", "csv"].includes(detectedExt)) {
        systemPrompt = "You are a spreadsheet extraction tool. Extract ALL data from this spreadsheet. Format it as structured text with clear headers and rows. Use table format where possible. Output ONLY the extracted data.";
        userPrompt = "Extract all data from this spreadsheet. Preserve column headers and row data in a readable structured format.";
      } else if (["pptx", "ppt"].includes(detectedExt)) {
        systemPrompt = "You are a presentation extraction tool. Extract ALL text content from each slide. Number each slide. Preserve titles, bullet points, and any text content. Output ONLY the extracted text.";
        userPrompt = "Extract all text content from every slide in this presentation. Number each slide.";
      } else if (["jpg", "jpeg", "png", "webp"].includes(detectedExt)) {
        systemPrompt = "You are an image content extraction tool. Extract ALL visible text from this image. If the image contains diagrams, charts, or visual information, describe them in detail. Output ONLY the extracted information.";
        userPrompt = "Extract all text and describe any visual content from this image in detail.";
      }

      console.log("Sending to AI for extraction, mime:", mimeType, "size:", fileBytes.length);

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
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
                { type: "text", text: userPrompt },
              ],
            },
          ],
          max_tokens: 16000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI extraction error:", aiResponse.status, errText);
        throw new Error(`Failed to extract content from document. AI error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      extractedText = aiData.choices?.[0]?.message?.content || "";

      if (!extractedText.trim()) {
        throw new Error("No content could be extracted from the SharePoint document");
      }
    }

    // Determine file_type label
    const fileTypeLabel = ["jpg", "jpeg", "png", "webp"].includes(detectedExt) ? "image" :
      ["csv", "xlsx", "xls"].includes(detectedExt) ? "spreadsheet" :
      ["pptx", "ppt"].includes(detectedExt) ? "pptx" :
      detectedExt || "sharepoint";

    // Insert document record
    const { data: doc, error: insertErr } = await supabase
      .from("documents")
      .insert({
        name: fileName,
        file_type: fileTypeLabel,
        category,
        content: extractedText,
        uploaded_by: user.id,
        version,
        is_latest: true,
        parent_document_id: parent_document_id || null,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Chunk the document
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
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("parse-sharepoint-url error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
