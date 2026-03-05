import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Trash2, Search, History, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Doc {
  id: string;
  name: string;
  file_type: string;
  category: string;
  created_at: string;
  content: string | null;
  version: number;
  is_latest: boolean;
  parent_document_id: string | null;
}

const CATEGORIES = ["Compliance", "SOP", "Products", "General Operations"];
const ACCEPTED_TYPES = ".txt,.pdf,.docx";
const ALLOWED_MIME: Record<string, string> = {
  "text/plain": "txt",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

export default function Documents() {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("SOP");
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versionHistory, setVersionHistory] = useState<Doc[]>([]);

  const loadDocs = async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, name, file_type, category, created_at, content, version, is_latest, parent_document_id")
      .eq("is_latest", true)
      .order("created_at", { ascending: false });
    setDocuments((data as Doc[]) || []);
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const loadVersionHistory = async (doc: Doc) => {
    // Find root document id
    const rootId = doc.parent_document_id || doc.id;
    const { data } = await supabase
      .from("documents")
      .select("id, name, file_type, category, created_at, content, version, is_latest, parent_document_id")
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
      .order("version", { ascending: false });
    setVersionHistory((data as Doc[]) || []);
    setShowVersions(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, replaceDocId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = ALLOWED_MIME[file.type];
    if (!fileExt) {
      toast.error("Only .txt, .pdf, and .docx files are supported");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be under 20MB");
      return;
    }

    setUploading(true);
    try {
      // If replacing, mark old version as not latest and get its version number
      let newVersion = 1;
      let parentId: string | null = null;
      if (replaceDocId) {
        const oldDoc = documents.find((d) => d.id === replaceDocId);
        if (oldDoc) {
          newVersion = oldDoc.version + 1;
          parentId = oldDoc.parent_document_id || oldDoc.id;
          await supabase.from("documents").update({ is_latest: false } as any).eq("id", replaceDocId);
        }
      }

      if (fileExt === "txt") {
        const content = await file.text();
        const insertData: any = {
          name: file.name,
          file_type: "txt",
          category: selectedCategory,
          content,
          version: newVersion,
          is_latest: true,
          parent_document_id: parentId,
        };
        const { data: doc, error } = await supabase
          .from("documents")
          .insert(insertData)
          .select()
          .single();
        if (error) throw error;

        const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 30);
        const chunks = paragraphs.map((p, i) => {
          const firstLine = p.split("\n")[0];
          const isTitle = firstLine.length < 100 && !firstLine.endsWith(".");
          return { document_id: doc.id, chunk_index: i, content: p.trim(), section_title: isTitle ? firstLine.trim() : null };
        });
        if (chunks.length > 0) await supabase.from("document_chunks").insert(chunks);
        toast.success(`Uploaded "${file.name}" v${newVersion} with ${chunks.length} chunks`);
      } else {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", selectedCategory);
        if (parentId) formData.append("parent_document_id", parentId);
        formData.append("version", String(newVersion));

        const { data: { session } } = await supabase.auth.getSession();
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/parse-document`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: formData,
          }
        );

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "Upload failed");
        toast.success(`Uploaded "${file.name}" v${newVersion} with ${result.chunks} chunks`);
      }
      loadDocs();
      setShowVersions(false);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) {
      toast.error("Delete failed");
    } else {
      toast.success("Document deleted");
      loadDocs();
      if (previewDoc?.id === id) setPreviewDoc(null);
    }
  };

  const filtered = documents.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="flex-1 flex flex-col p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-foreground">Knowledge Base</h1>
            <p className="text-sm text-muted-foreground">{documents.length} documents indexed</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept={ACCEPTED_TYPES}
                  onChange={(e) => handleFileUpload(e)}
                  className="hidden"
                  disabled={uploading}
                />
                <Button asChild disabled={uploading}>
                  <span className="bg-primary hover:bg-primary/80 text-primary-foreground">
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Document"}
                  </span>
                </Button>
              </label>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>

        {/* Documents list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filtered.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setPreviewDoc(doc)}
              className={`glass-panel rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors ${
                previewDoc?.id === doc.id ? "border-primary/40 bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                      {doc.category}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-mono">
                      v{doc.version}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {isAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-primary"
                      title="Version history"
                      onClick={(e) => {
                        e.stopPropagation();
                        loadVersionHistory(doc);
                      }}
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept={ACCEPTED_TYPES}
                        onChange={(e) => handleFileUpload(e, doc.id)}
                        className="hidden"
                        disabled={uploading}
                      />
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-accent"
                        title="Upload new version"
                      >
                        <span><RefreshCw className="w-4 h-4" /></span>
                      </Button>
                    </label>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? "No documents match your search" : "No documents uploaded yet"}
            </div>
          )}
        </div>
      </div>

      {/* Version history panel */}
      {showVersions && (
        <div className="w-80 border-l border-border bg-card/40 flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-accent" /> Version History
            </h3>
            <button onClick={() => setShowVersions(false)} className="text-muted-foreground hover:text-foreground">
              <span className="text-lg">×</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {versionHistory.map((v) => (
              <div
                key={v.id}
                onClick={() => setPreviewDoc(v)}
                className={`glass-panel rounded-lg p-3 cursor-pointer hover:border-primary/30 transition-colors ${
                  v.is_latest ? "border-accent/30" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                    v{v.version}
                  </span>
                  {v.is_latest && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent">
                      Latest
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground mt-1 truncate">{v.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document preview */}
      {previewDoc && !showVersions && (
        <div className="w-96 border-l border-border bg-card/40 flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">{previewDoc.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-accent">{previewDoc.category}</span>
              <span className="text-xs font-mono text-primary">v{previewDoc.version}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
              {previewDoc.content}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
