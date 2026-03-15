

# Plan: Add PPTX Download to Presentation Page

## What
Add a "Download PPTX" button to the `/presentation` page that generates and downloads a real `.pptx` PowerPoint file containing all 12 slides with proper formatting, diagrams, and content.

## Approach
- Install `pptxgenjs` — a client-side library that generates PowerPoint files in the browser
- Create a `src/lib/generate-pptx.ts` utility that builds all 12 slides programmatically using PptxGenJS API (text boxes, shapes, arrows, colors matching the current design)
- Add a download button to the presentation page UI (top-right, next to fullscreen)
- Keep the existing in-browser presentation as-is — the PPTX download is an additional export

## Slide Content in PPTX
Each slide will be recreated with PptxGenJS equivalents:
1. **Title** — centered text, gradient background via shape fills
2. **Business Need** — 2x2 grid of text boxes with icons
3. **Target Segment** — bullet list with descriptions
4. **Solution Overview** — text blocks with key points
5. **System Architecture** — rectangles + arrows (shapes API)
6. **RAG Pipeline Flow** — horizontal flow of rounded rectangles + arrow connectors
7. **Key Features** — 6 feature cards as grouped shapes
8. **Tech Stack** — categorized text blocks
9. **Document Ingestion** — format list with descriptions
10. **Security & Governance** — bullet points with icons
11. **Impact & Roadmap** — metrics + timeline
12. **Thank You** — centered text with links

## Colors
Dark theme matching the app: dark navy background (`#0f1729`), teal accent (`#2dd4bf`), white text.

## Files
1. **Install**: `pptxgenjs` package
2. **Create**: `src/lib/generate-pptx.ts` — slide generation logic
3. **Edit**: `src/pages/Presentation.tsx` — add download button

