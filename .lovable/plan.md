

# Plan: Build In-App Slide Presentation for Stage 2 Submission

## Overview
Create a full-screen slide presentation at `/presentation` route, rendering slides at 1920x1080 with scaling, keyboard navigation, and fullscreen mode. Content will follow the reference PPTX structure adapted to the actual SOPAssist AI implementation.

## Slide Deck (12 slides)

1. **Title Slide** - "SOPAssist AI - AI Powered Knowledge Chatbot for Banking Operations", team name, Virtusa Jatayu Season 5
2. **Business Need / Problem Statement** - Fragmented knowledge, SME dependency, regulatory pressure (from reference PPTX)
3. **Target Segment / Market Size** - L1/L2 ops teams, compliance/audit, new joiners
4. **Solution Overview** - RAG-based chatbot with citation-backed responses, low-cost architecture
5. **System Architecture** - Visual flowchart diagram showing Frontend > Edge Functions > Full-text Search > LLM pipeline (built with CSS/HTML boxes and arrows)
6. **RAG Pipeline Flow** - Step-by-step: Upload > Chunk > Search > Retrieve > Generate > Cite (visual flowchart)
7. **Key Features** - 6 feature cards: AI Chat, Multi-format Ingestion, Semantic Search, Citations, Analytics, RBAC
8. **Tech Stack** - React/Vite/TypeScript frontend, Lovable Cloud backend, Groq LLM, Postgres full-text search, Edge Functions
9. **Document Ingestion** - Supported formats (PDF, DOCX, TXT, Images, Emails, CSV/Excel), AI-powered extraction pipeline
10. **Security & Governance** - RBAC, audit logs, approved-source-only, informational-only design
11. **Expected Impact & Future Readiness** - Metrics (30-50% faster retrieval, etc.), scalability roadmap
12. **Thank You / Demo** - Live demo link, GitHub repo link

## Technical Approach

- **Single page component**: `src/pages/Presentation.tsx` (~500 lines)
- **Scaling**: Fixed 1920x1080 slides scaled with `transform: scale()` to fit viewport
- **Navigation**: Arrow keys, click, fullscreen (F5/button)
- **Diagrams**: Built with styled divs and CSS arrows (no external lib needed)
- **Route**: Add `/presentation` to `App.tsx`
- **No database changes needed**

## Files to Create/Edit
1. **Create** `src/pages/Presentation.tsx` - Full slide deck component
2. **Edit** `src/App.tsx` - Add `/presentation` route

