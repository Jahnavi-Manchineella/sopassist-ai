import PptxGenJS from "pptxgenjs";

const BG = "0f1729";
const TEAL = "2dd4bf";
const AMBER = "eab308";
const WHITE = "FFFFFF";
const MUTED = "8899aa";
const CARD_BG = "162033";
const PURPLE = "a855f7";

function addBg(slide: PptxGenJS.Slide) {
  slide.background = { color: BG };
}

function badge(slide: PptxGenJS.Slide, text: string, y = 0.4) {
  slide.addText(text.toUpperCase(), {
    x: 0.8, y, w: 3, h: 0.35,
    fontSize: 9, fontFace: "Arial", color: TEAL, bold: true,
    letterSpacing: 3,
  });
}

function slideNum(slide: PptxGenJS.Slide, n: number) {
  slide.addText(`${n} / 12`, {
    x: 8.5, y: 7, w: 1.2, h: 0.3,
    fontSize: 9, fontFace: "Arial", color: MUTED, align: "right",
  });
}

function addBox(slide: PptxGenJS.Slide, x: number, y: number, w: number, h: number, opts: { title: string; body?: string; color?: string; emoji?: string }) {
  const c = opts.color || TEAL;
  slide.addShape("roundRect", { x, y, w, h, fill: { color: BG }, line: { color: c, width: 1 }, rectRadius: 0.1 });
  let ty = y + 0.15;
  if (opts.emoji) {
    slide.addText(opts.emoji, { x, y: ty, w, h: 0.4, fontSize: 20, align: "center" });
    ty += 0.35;
  }
  slide.addText(opts.title, { x: x + 0.15, y: ty, w: w - 0.3, h: 0.35, fontSize: 13, fontFace: "Arial", color: c, bold: true, align: "center" });
  if (opts.body) {
    slide.addText(opts.body, { x: x + 0.15, y: ty + 0.35, w: w - 0.3, h: h - (ty - y) - 0.55, fontSize: 10, fontFace: "Arial", color: MUTED, align: "center", valign: "top" });
  }
}

function arrow(slide: PptxGenJS.Slide, x1: number, y1: number, x2: number, y2: number, color = TEAL) {
  slide.addShape("line", {
    x: x1, y: y1, w: x2 - x1 || 0.01, h: y2 - y1 || 0.01,
    line: { color, width: 1.5, endArrowType: "triangle" },
  });
}

export function generatePptx() {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Team Ardents";
  pptx.title = "SOPAssist AI - Stage 2 POC";

  // ── Slide 1: Title ──
  {
    const s = pptx.addSlide();
    addBg(s);
    s.addText("🤖", { x: 4.2, y: 1.5, w: 1.2, h: 0.8, fontSize: 40, align: "center" });
    s.addText("SOPAssist AI", { x: 1, y: 2.5, w: 8, h: 0.8, fontSize: 40, fontFace: "Arial", color: WHITE, bold: true, align: "center" });
    s.addText("AI-Powered Knowledge Chatbot for Banking Operations", { x: 1.5, y: 3.3, w: 7, h: 0.5, fontSize: 18, fontFace: "Arial", color: TEAL, align: "center" });
    s.addText("Team Ardents  •  Virtusa Jatayu Season 5  •  Use Case 2", { x: 1, y: 4.2, w: 8, h: 0.4, fontSize: 13, fontFace: "Arial", color: MUTED, align: "center" });
    s.addText("Stage 2 — Proof of Concept", { x: 2.5, y: 5.2, w: 5, h: 0.45, fontSize: 14, fontFace: "Arial", color: BG, bold: true, align: "center", fill: { color: TEAL }, rectRadius: 0.15 });
  }

  // ── Slide 2: Business Need ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Problem Statement");
    s.addText("Why SOPAssist AI?", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const items = [
      { emoji: "📚", title: "Fragmented Knowledge", body: "SOPs, policies and guidelines are scattered across shared drives, emails, and wikis — making retrieval slow and error-prone." },
      { emoji: "👤", title: "SME Dependency", body: "Teams rely on senior staff for answers, creating bottlenecks and single points of failure." },
      { emoji: "⚠️", title: "Compliance Risk", body: "Outdated or incorrect information leads to regulatory violations and operational failures." },
      { emoji: "⏱️", title: "Slow Onboarding", body: "New employees take weeks to become productive, lacking a single source of truth." },
    ];
    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      addBox(s, 0.8 + col * 4.2, 1.8 + row * 2.3, 3.8, 2, item);
    });
    slideNum(s, 2);
  }

  // ── Slide 3: Target Segment ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Target Segment");
    s.addText("Who Benefits?", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const segments = [
      { title: "L1/L2 Operations Teams", desc: "Front-line banking ops staff who need quick, accurate answers from SOPs and process docs.", pct: "60%" },
      { title: "Compliance & Audit Teams", desc: "Teams that need traceable, citation-backed responses for regulatory queries.", pct: "25%" },
      { title: "New Joiners & Trainees", desc: "Employees in onboarding who need a self-service knowledge assistant.", pct: "15%" },
    ];
    segments.forEach((seg, i) => {
      const y = 1.8 + i * 1.6;
      s.addShape("roundRect", { x: 0.8, y, w: 8, h: 1.3, fill: { color: CARD_BG }, line: { color: TEAL, width: 0.5 }, rectRadius: 0.1 });
      s.addText(seg.pct, { x: 1, y: y + 0.15, w: 1, h: 0.6, fontSize: 24, fontFace: "Arial", color: TEAL, bold: true, align: "center" });
      s.addText(seg.title, { x: 2.2, y: y + 0.15, w: 6, h: 0.4, fontSize: 15, fontFace: "Arial", color: WHITE, bold: true });
      s.addText(seg.desc, { x: 2.2, y: y + 0.6, w: 6, h: 0.5, fontSize: 11, fontFace: "Arial", color: MUTED });
    });
    slideNum(s, 3);
  }

  // ── Slide 4: Solution Overview ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Solution");
    s.addText("SOPAssist AI — Solution Overview", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const points = [
      "RAG-based chatbot that retrieves relevant SOP chunks and generates grounded answers with citations",
      "Multi-format document ingestion: PDF, DOCX, TXT, Images (OCR), Emails, CSV/Excel",
      "Full-text search with PostgreSQL tsvector — no expensive vector DB or embeddings needed",
      "Role-based access control (RBAC) with complete audit trail of every query",
      "Built on Supabase Edge Functions + Groq LLM for sub-second responses at minimal cost",
    ];
    points.forEach((p, i) => {
      s.addText(`✅  ${p}`, { x: 1, y: 1.8 + i * 0.85, w: 8, h: 0.7, fontSize: 13, fontFace: "Arial", color: WHITE, valign: "top" });
    });
    slideNum(s, 4);
  }

  // ── Slide 5: System Architecture ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Architecture");
    s.addText("System Architecture", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    // Boxes
    const boxes: [number, number, number, number, string, string][] = [
      [0.5, 2.5, 2, 1, "React Frontend", TEAL],
      [3.5, 2.5, 2, 1, "Edge Functions", AMBER],
      [3.5, 4.5, 2, 1, "PostgreSQL FTS", PURPLE],
      [6.5, 2.5, 2, 1, "Groq LLM", TEAL],
      [6.5, 4.5, 2, 1, "Document Store", AMBER],
    ];
    boxes.forEach(([x, y, w, h, label, c]) => {
      s.addShape("roundRect", { x, y, w, h, fill: { color: CARD_BG }, line: { color: c, width: 1.5 }, rectRadius: 0.1 });
      s.addText(label, { x, y, w, h, fontSize: 13, fontFace: "Arial", color: c, bold: true, align: "center", valign: "middle" });
    });
    // Arrows
    arrow(s, 2.5, 3, 3.5, 3);
    arrow(s, 5.5, 3, 6.5, 3);
    arrow(s, 4.5, 3.5, 4.5, 4.5);
    arrow(s, 6.5, 4.5, 5.5, 4.5, AMBER);

    s.addText("User queries flow: Frontend → Edge Functions → FTS retrieval → LLM generation → Response with citations", {
      x: 0.8, y: 6, w: 8, h: 0.5, fontSize: 11, fontFace: "Arial", color: MUTED, align: "center",
    });
    slideNum(s, 5);
  }

  // ── Slide 6: RAG Pipeline ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "RAG Pipeline");
    s.addText("Retrieval-Augmented Generation Flow", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const steps = ["Upload", "Parse", "Chunk", "Index", "Search", "Retrieve", "Generate", "Cite"];
    const colors = [AMBER, AMBER, TEAL, TEAL, PURPLE, PURPLE, TEAL, AMBER];
    const stepW = 1.05;
    const startX = 0.3;
    steps.forEach((label, i) => {
      const x = startX + i * (stepW + 0.15);
      s.addShape("roundRect", { x, y: 2.5, w: stepW, h: 0.8, fill: { color: CARD_BG }, line: { color: colors[i], width: 1.5 }, rectRadius: 0.1 });
      s.addText(label, { x, y: 2.5, w: stepW, h: 0.8, fontSize: 11, fontFace: "Arial", color: colors[i], bold: true, align: "center", valign: "middle" });
      if (i < steps.length - 1) {
        arrow(s, x + stepW, 2.9, x + stepW + 0.15, 2.9, colors[i]);
      }
    });

    const details = [
      ["Upload", "PDF, DOCX, TXT, images, emails uploaded via UI"],
      ["Parse", "Edge Function extracts text using AI-powered parsing"],
      ["Chunk", "Content split into overlapping sections with metadata"],
      ["Index", "PostgreSQL tsvector full-text search index created"],
      ["Search", "User query matched against chunks using ts_rank"],
      ["Retrieve", "Top-k relevant chunks returned with metadata"],
      ["Generate", "Groq LLM synthesizes answer from retrieved context"],
      ["Cite", "Response includes document name and section references"],
    ];
    details.forEach(([step, desc], i) => {
      s.addText(`${step}: ${desc}`, { x: 0.8, y: 3.8 + i * 0.42, w: 8, h: 0.4, fontSize: 10, fontFace: "Arial", color: MUTED });
    });
    slideNum(s, 6);
  }

  // ── Slide 7: Key Features ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Features");
    s.addText("Key Features", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const features = [
      { emoji: "💬", title: "AI Chat Interface", desc: "Streaming responses with markdown rendering and conversation history" },
      { emoji: "📄", title: "Multi-Format Ingestion", desc: "PDF, DOCX, TXT, Images, Emails, CSV/Excel with AI-powered extraction" },
      { emoji: "🔍", title: "Full-Text Search", desc: "PostgreSQL tsvector search — no vector DB or embedding costs" },
      { emoji: "📎", title: "Citation Tracking", desc: "Every response includes source document and section references" },
      { emoji: "📊", title: "Analytics Dashboard", desc: "Query patterns, response times, category distribution insights" },
      { emoji: "🔐", title: "RBAC & Audit", desc: "Role-based access with complete audit trail of all queries" },
    ];
    features.forEach((f, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      addBox(s, 0.5 + col * 3.1, 1.8 + row * 2.5, 2.8, 2.2, { emoji: f.emoji, title: f.title, body: f.desc, color: i % 2 === 0 ? TEAL : AMBER });
    });
    slideNum(s, 7);
  }

  // ── Slide 8: Tech Stack ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Technology");
    s.addText("Tech Stack", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const stacks = [
      { cat: "Frontend", items: "React 18 + Vite + TypeScript\nTailwind CSS + shadcn/ui\nReact Router, React Query", color: TEAL },
      { cat: "Backend", items: "Supabase Edge Functions (Deno)\nPostgreSQL with FTS\nRow-Level Security (RLS)", color: AMBER },
      { cat: "AI / LLM", items: "Groq API (Llama 3 / Mixtral)\nRAG with full-text retrieval\nStreaming responses", color: PURPLE },
      { cat: "DevOps", items: "Lovable for deployment\nSupabase Cloud hosting\nGitHub version control", color: TEAL },
    ];
    stacks.forEach((st, i) => {
      const x = 0.5 + i * 2.35;
      s.addShape("roundRect", { x, y: 1.8, w: 2.1, h: 3.5, fill: { color: CARD_BG }, line: { color: st.color, width: 1 }, rectRadius: 0.1 });
      s.addText(st.cat, { x, y: 1.9, w: 2.1, h: 0.5, fontSize: 14, fontFace: "Arial", color: st.color, bold: true, align: "center" });
      s.addText(st.items, { x: x + 0.15, y: 2.5, w: 1.8, h: 2.5, fontSize: 11, fontFace: "Arial", color: WHITE, valign: "top" });
    });
    slideNum(s, 8);
  }

  // ── Slide 9: Document Ingestion ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Ingestion");
    s.addText("Document Ingestion Pipeline", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const formats = [
      { fmt: "PDF", desc: "Structured and scanned documents", icon: "📕" },
      { fmt: "DOCX", desc: "Microsoft Word documents", icon: "📘" },
      { fmt: "TXT", desc: "Plain text files", icon: "📝" },
      { fmt: "Images", desc: "OCR-powered text extraction", icon: "🖼️" },
      { fmt: "Email (.eml)", desc: "Email content and attachments", icon: "📧" },
      { fmt: "CSV / Excel", desc: "Tabular data processing", icon: "📊" },
    ];
    formats.forEach((f, i) => {
      const y = 1.7 + i * 0.8;
      s.addText(`${f.icon}  ${f.fmt}`, { x: 1, y, w: 2.5, h: 0.5, fontSize: 13, fontFace: "Arial", color: TEAL, bold: true });
      s.addText(f.desc, { x: 3.5, y, w: 5, h: 0.5, fontSize: 12, fontFace: "Arial", color: WHITE });
    });

    s.addText("Pipeline: Upload → AI Parse → Chunk (500 chars, 50 overlap) → PostgreSQL tsvector Index → Ready for Search", {
      x: 0.8, y: 6.3, w: 8, h: 0.5, fontSize: 11, fontFace: "Arial", color: MUTED, align: "center",
    });
    slideNum(s, 9);
  }

  // ── Slide 10: Security ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Security");
    s.addText("Security & Governance", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const items = [
      "🔐  Role-Based Access Control — Admin and User roles with distinct permissions",
      "📋  Complete Audit Trail — Every query, response, and retrieved chunk is logged",
      "✅  Approved Sources Only — Responses generated exclusively from uploaded, verified documents",
      "ℹ️  Informational Design — Clearly marked as advisory; critical decisions require human verification",
      "🛡️  Row-Level Security — Database-level policies ensure data isolation per user",
      "🔒  Edge Function Auth — All API endpoints validate JWT tokens before processing",
    ];
    items.forEach((item, i) => {
      s.addText(item, { x: 1, y: 1.8 + i * 0.8, w: 8, h: 0.6, fontSize: 13, fontFace: "Arial", color: WHITE, valign: "top" });
    });
    slideNum(s, 10);
  }

  // ── Slide 11: Impact ──
  {
    const s = pptx.addSlide();
    addBg(s);
    badge(s, "Impact");
    s.addText("Expected Impact & Future Roadmap", { x: 0.8, y: 0.9, w: 8, h: 0.6, fontSize: 28, fontFace: "Arial", color: WHITE, bold: true });

    const metrics = [
      { val: "30-50%", label: "Faster information retrieval" },
      { val: "80%+", label: "Reduction in SME dependency" },
      { val: "<2s", label: "Average response time" },
      { val: "100%", label: "Query audit coverage" },
    ];
    metrics.forEach((m, i) => {
      const x = 0.5 + i * 2.35;
      s.addShape("roundRect", { x, y: 1.8, w: 2.1, h: 1.5, fill: { color: CARD_BG }, line: { color: TEAL, width: 1 }, rectRadius: 0.1 });
      s.addText(m.val, { x, y: 1.9, w: 2.1, h: 0.7, fontSize: 28, fontFace: "Arial", color: TEAL, bold: true, align: "center" });
      s.addText(m.label, { x, y: 2.6, w: 2.1, h: 0.5, fontSize: 11, fontFace: "Arial", color: MUTED, align: "center" });
    });

    s.addText("Future Roadmap", { x: 0.8, y: 3.8, w: 4, h: 0.5, fontSize: 18, fontFace: "Arial", color: AMBER, bold: true });
    const roadmap = [
      "Phase 1: Vector embeddings for semantic search (hybrid FTS + vector)",
      "Phase 2: Multi-language support and voice-based queries",
      "Phase 3: Automated SOP update detection and notification system",
      "Phase 4: Integration with enterprise systems (ServiceNow, JIRA, Confluence)",
    ];
    roadmap.forEach((r, i) => {
      s.addText(`→  ${r}`, { x: 1, y: 4.4 + i * 0.55, w: 8, h: 0.45, fontSize: 12, fontFace: "Arial", color: WHITE });
    });
    slideNum(s, 11);
  }

  // ── Slide 12: Thank You ──
  {
    const s = pptx.addSlide();
    addBg(s);
    s.addText("Thank You", { x: 1, y: 2, w: 8, h: 1, fontSize: 44, fontFace: "Arial", color: WHITE, bold: true, align: "center" });
    s.addText("SOPAssist AI — AI-Powered Knowledge Chatbot for Banking Operations", { x: 1.5, y: 3.2, w: 7, h: 0.5, fontSize: 16, fontFace: "Arial", color: TEAL, align: "center" });
    s.addText("Team Ardents  •  Virtusa Jatayu Season 5", { x: 2, y: 4, w: 6, h: 0.4, fontSize: 14, fontFace: "Arial", color: MUTED, align: "center" });
    s.addText("🌐  Live Demo: sopassist-ai.lovable.app", { x: 2, y: 5, w: 6, h: 0.4, fontSize: 13, fontFace: "Arial", color: WHITE, align: "center" });
    s.addText("Questions?", { x: 3, y: 6, w: 4, h: 0.5, fontSize: 18, fontFace: "Arial", color: AMBER, bold: true, align: "center" });
  }

  return pptx;
}

export async function downloadPptx() {
  const pptx = generatePptx();
  await pptx.writeFile({ fileName: "Ardents_SOPAssist_AI.pptx" });
}
