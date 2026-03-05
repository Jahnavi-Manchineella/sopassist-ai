import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface Doc {
  id: string;
  name: string;
  file_type: string;
  category: string;
  created_at: string;
  content: string | null;
}

const CATEGORIES = ["Compliance", "SOP", "Products", "General Operations"];

export default function Documents() {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("SOP");
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);

  const loadDocs = async () => {
    const { data } = await supabase
      .from("documents")
      .select("id, name, file_type, category, created_at, content")
      .order("created_at", { ascending: false });
    setDocuments(data || []);
  };

  useEffect(() => {
    loadDocs();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["text/plain"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only .txt files are supported in this demo");
      return;
    }

    setUploading(true);
    try {
      const content = await file.text();

      // Insert document
      const { data: doc, error } = await supabase
        .from("documents")
        .insert({
          name: file.name,
          file_type: "txt",
          category: selectedCategory,
          content,
        })
        .select()
        .single();

      if (error) throw error;

      // Chunk the document by paragraphs
      const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 50);
      const chunks = paragraphs.map((p, i) => {
        // Try to extract section title
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
        await supabase.from("document_chunks").insert(chunks);
      }

      toast.success(`Uploaded "${file.name}" with ${chunks.length} chunks`);
      loadDocs();
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
                  accept=".txt"
                  onChange={handleFileUpload}
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
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(doc.id);
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              {search ? "No documents match your search" : "No documents uploaded yet"}
            </div>
          )}
        </div>
      </div>

      {/* Document preview */}
      {previewDoc && (
        <div className="w-96 border-l border-border bg-card/40 flex flex-col">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">{previewDoc.name}</h3>
            <span className="text-xs text-accent">{previewDoc.category}</span>
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
