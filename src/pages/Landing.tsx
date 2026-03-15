import { useNavigate } from "react-router-dom";
import { Bot, Shield, FileText, BarChart3, Search, Clock, Users, Zap, ArrowRight, MessageSquare, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Bot,
    title: "AI-Powered Answers",
    description: "Get instant, context-aware responses grounded in your internal knowledge base with source citations.",
  },
  {
    icon: Search,
    title: "Smart Retrieval",
    description: "Full-text search across SOPs, compliance docs, and product guides — no more keyword mismatch frustration.",
  },
  {
    icon: Shield,
    title: "Compliance First",
    description: "Role-based access, audit trails, and query categorization ensure full traceability and regulatory alignment.",
  },
  {
    icon: FileText,
    title: "Document Ingestion",
    description: "Upload PDF, DOCX, and TXT files. AI-powered extraction auto-chunks and indexes content for retrieval.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track query patterns, category breakdowns, and usage trends to optimize your knowledge base.",
  },
  {
    icon: Clock,
    title: "Version Control",
    description: "Track policy updates with document versioning. Always retrieve answers from the latest approved version.",
  },
];

const BENEFITS = [
  { metric: "30–50%", label: "Reduction in time to find answers" },
  { metric: "20–35%", label: "Deflection of routine queries from SMEs" },
  { metric: "25–40%", label: "Faster onboarding for new staff" },
  { metric: "100%", label: "Audit trail coverage" },
];

const USE_CASES = [
  "KYC & onboarding procedures",
  "AML compliance policies",
  "Transaction processing rules",
  "Exception handling steps",
  "Regulatory reporting requirements",
  "Product & account guidelines",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 glass-panel border-b border-border/30">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center glow-primary">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">
              SOP<span className="text-primary">Assist</span> AI
            </span>
          </div>
          <Button
            onClick={() => navigate("/login")}
            className="bg-primary text-primary-foreground hover:bg-primary/85 px-5"
          >
            Sign In <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel text-xs text-muted-foreground mb-8">
            <Zap className="w-3.5 h-3.5 text-accent" />
            AI-Powered Knowledge Assistant for Banking Operations
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] mb-6">
            Find answers in
            <span className="text-gradient"> seconds</span>,
            <br />
            not hours
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Stop searching through fragmented SharePoint sites, PDFs, and email threads.
            Get instant, citation-backed answers from your internal knowledge base — powered by RAG and LLM technology.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              onClick={() => navigate("/chat")}
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/85 px-8 py-6 text-base glow-primary"
            >
              <MessageSquare className="w-5 h-5 mr-2" /> Get Started
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-border/60 text-muted-foreground hover:text-foreground px-8 py-6 text-base"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              See Features
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits strip */}
      <section className="py-12 border-y border-border/30 bg-secondary/20">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {BENEFITS.map((b) => (
            <div key={b.label} className="text-center">
              <p className="text-3xl font-bold text-gradient">{b.metric}</p>
              <p className="text-sm text-muted-foreground mt-1">{b.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-3">
              Everything your ops team needs
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Purpose-built for banking operations with enterprise-grade security, compliance, and auditability.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="glass-panel rounded-2xl p-6 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:glow-primary transition-all">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-20 px-6 bg-secondary/10 border-y border-border/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">What can you ask?</h2>
            <p className="text-muted-foreground">
              From day-to-day procedures to complex compliance queries — get answers instantly.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {USE_CASES.map((uc) => (
              <div key={uc} className="flex items-center gap-3 glass-panel rounded-xl px-5 py-4">
                <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm text-foreground">{uc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Challenges solved */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6">
              Solving real challenges in
              <span className="text-gradient"> banking ops</span>
            </h2>
            <div className="space-y-4">
              {[
                { icon: FileText, text: "Information fragmented across SharePoint, Confluence, emails, and PDFs" },
                { icon: Clock, text: "Policy churn makes it hard to track the latest versions" },
                { icon: Users, text: "SME bottlenecks cause delays for routine queries" },
                { icon: Search, text: "Keyword search fails due to format and terminology mismatches" },
                { icon: Shield, text: "Limited traceability of what guidance was used, when, and by whom" },
              ].map((item) => (
                <div key={item.text} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <item.icon className="w-4 h-4 text-accent" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-panel rounded-2xl p-8 border-primary/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center glow-primary">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">SOPAssist AI</p>
                <p className="text-xs text-muted-foreground">Banking Knowledge Assistant</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 ml-auto max-w-[80%]">
                <p className="text-sm text-foreground">What are the KYC requirements for new accounts?</p>
              </div>
              <div className="glass-panel rounded-xl px-4 py-3 max-w-[90%]">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  All new account openings must follow the KYC verification process. Required documents include:
                  government-issued photo ID, proof of address dated within 90 days...
                  <span className="text-primary font-mono text-xs ml-1">[Source 1]</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center glass-panel rounded-3xl p-12 border-primary/20 glow-primary">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your operations?</h2>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            Start finding answers faster with AI-powered knowledge retrieval built for banking teams.
          </p>
          <Button
            onClick={() => navigate("/chat")}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/85 px-10 py-6 text-base"
          >
            Get Started Now <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border/20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">SOPAssist AI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            AI-Powered Knowledge Chatbot for Banking Operations
          </p>
        </div>
      </footer>
    </div>
  );
}
