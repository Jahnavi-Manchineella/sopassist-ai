

## Plan: Generate RAG Pipeline Diagram as JPEG

### Approach
Create a backend function that uses the Gemini image generation model (`google/gemini-2.5-flash-image`) to generate a professional RAG pipeline architecture diagram as an image, and a simple page/component to display and download it.

### Steps

1. **Create Edge Function `supabase/functions/generate-diagram/index.ts`**
   - Accepts a prompt describing the RAG pipeline diagram
   - Calls `https://ai.gateway.lovable.dev/v1/chat/completions` with `google/gemini-2.5-flash-image` model and `modalities: ["image", "text"]`
   - Prompt will describe the exact RAG pipeline flow: User Query → Auth → Category Filter → search_chunks RPC (FTS via tsvector) → Keyword Fallback (ilike) → Context Builder → Citation Assembler → Groq LLM (llama-3.3-70b) → SSE Stream → Chat UI with Citations
   - Returns the base64 image in the response

2. **Create page `src/pages/DiagramGenerator.tsx`**
   - Button to trigger diagram generation
   - Displays the generated image
   - Provides a "Download as JPEG" button using canvas conversion
   - Loading state while generating

3. **Add route `/diagram` in `src/App.tsx`**
   - Protected route accessible to authenticated users

### Technical Details
- The edge function uses `LOVABLE_API_KEY` (already configured) for the AI gateway
- Image is returned as base64 `data:image/png;base64,...` and converted to JPEG on the client side using HTML Canvas `toDataURL('image/jpeg')`
- The prompt will be detailed and specific to produce a clean, professional architecture diagram with labeled boxes, arrows, and the SOPAssist AI branding

