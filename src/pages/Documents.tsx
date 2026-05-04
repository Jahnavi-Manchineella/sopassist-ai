import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileText, Trash2, Search, History, RefreshCw, Image, Mail, Table, Link, Loader2 } from "lucide-react";
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

const CATEGORIES = ["Auto", "Compliance", "SOP", "Products", "General Operations"];
const ACCEPTED_TYPES = ".txt,.pdf,.docx,.jpg,.jpeg,.png,.webp,.eml,.msg,.csv,.xlsx,.xls";
const ALLOWED_EXTENSIONS = ["txt", "pdf", "docx", "jpg", "jpeg", "png", "webp", "eml", "msg", "csv", "xlsx", "xls"];

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  image: Image,
  email: Mail,
  spreadsheet: Table,
};

export default function Documents() {
  const { isAdmin } = useAuth();
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Auto");
  const [previewDoc, setPreviewDoc] = useState<Doc | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versionHistory, setVersionHistory] = useState<Doc[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [sharepointUrl, setSharepointUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [activeKB, setActiveKB] = useState<string>("All");

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

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      toast.error(`Unsupported file type. Supported: PDF, DOCX, TXT, JPG, PNG, WEBP, EML, MSG, CSV, XLSX, XLS`);
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be under 20MB");
      return;
    }

    setUploading(true);
    try {
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

      // Helper: ask edge function to classify text content
      const classify = async (text: string, fname: string): Promise<string> => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
          const res = await fetch(
            `https://${projectId}.supabase.co/functions/v1/classify-document`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session?.access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ filename: fname, text: text.slice(0, 6000) }),
            }
          );
          const j = await res.json();
          return j.category || "General Operations";
        } catch {
          return "General Operations";
        }
      };

      const isAuto = selectedCategory === "Auto";

      if (fileExt === "txt") {
        const content = await file.text();
        const finalCategory = isAuto ? await classify(content, file.name) : selectedCategory;
        const insertData: any = {
          name: file.name,
          file_type: "txt",
          category: finalCategory,
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
        toast.success(`Uploaded "${file.name}" → ${finalCategory} (v${newVersion}, ${chunks.length} chunks)`);
      } else if (fileExt === "csv") {
        // Process CSV client-side
        const csvText = await file.text();
        const content = `CSV Data: ${file.name}\n\n${csvText}`;
        const finalCategory = isAuto ? await classify(content, file.name) : selectedCategory;
        const insertData: any = {
          name: file.name,
          file_type: "spreadsheet",
          category: finalCategory,
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

        // Chunk CSV by rows (every ~50 rows)
        const lines = csvText.split("\n").filter(l => l.trim());
        const header = lines[0] || "";
        const chunkSize = 50;
        const chunks = [];
        for (let i = 1; i < lines.length; i += chunkSize) {
          const slice = lines.slice(i, i + chunkSize);
          chunks.push({
            document_id: doc.id,
            chunk_index: Math.floor(i / chunkSize),
            content: `${header}\n${slice.join("\n")}`,
            section_title: `Rows ${i}-${Math.min(i + chunkSize - 1, lines.length - 1)}`,
          });
        }
        if (chunks.length > 0) await supabase.from("document_chunks").insert(chunks);
        toast.success(`Uploaded "${file.name}" → ${finalCategory} (v${newVersion}, ${chunks.length} chunks)`);
      } else {
        // Send to edge function for AI extraction (PDF, DOCX, images, emails, Excel)
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
        toast.success(`Uploaded "${file.name}" → ${result.category || selectedCategory} (v${newVersion}, ${result.chunks} chunks)`);
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

  const handleSharepointUrl = async () => {
    if (!sharepointUrl.trim()) return;
    setUrlLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/parse-sharepoint-url`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: sharepointUrl.trim(),
            category: selectedCategory,
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to parse SharePoint URL");
      toast.success(`Imported "${result.name}" with ${result.chunks} chunks`);
      setSharepointUrl("");
      setShowUrlInput(false);
      loadDocs();
    } catch (err: any) {
      toast.error(err.message || "Failed to import from SharePoint");
    } finally {
      setUrlLoading(false);
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

  const getDocIcon = (fileType: string) => {
    const IconComponent = FILE_TYPE_ICONS[fileType] || FileText;
    return IconComponent;
  };

  const getFileTypeLabel = (fileType: string) => {
    const labels: Record<string, string> = {
      image: "Image",
      email: "Email",
      spreadsheet: "Spreadsheet",
      pdf: "PDF",
      docx: "DOCX",
      txt: "TXT",
    };
    return labels[fileType] || fileType.toUpperCase();
  };

  const filtered = documents.filter(
    (d) =>
      (activeKB === "All" || d.category === activeKB) &&
      (
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.category.toLowerCase().includes(search.toLowerCase()) ||
        d.file_type.toLowerCase().includes(search.toLowerCase())
      )
  );

  const kbCounts = ["All", ...CATEGORIES].reduce<Record<string, number>>((acc, k) => {
    acc[k] = k === "All" ? documents.length : documents.filter((d) => d.category === k).length;
    return acc;
  }, {});

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
                    {uploading ? "Processing..." : "Upload Document"}
                  </span>
                </Button>
              </label>
              <Button
                variant="outline"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="border-border text-foreground"
              >
                <Link className="w-4 h-4 mr-2" />
                SharePoint URL
              </Button>
            </div>
          )}
        </div>

        {/* SharePoint URL input */}
        {showUrlInput && isAdmin && (
          <div className="mb-4 flex items-center gap-2">
            <Input
              value={sharepointUrl}
              onChange={(e) => setSharepointUrl(e.target.value)}
              placeholder="Paste SharePoint / OneDrive URL here..."
              className="flex-1 bg-secondary/50 border-border/50"
              onKeyDown={(e) => e.key === "Enter" && handleSharepointUrl()}
            />
            <Button
              onClick={handleSharepointUrl}
              disabled={urlLoading || !sharepointUrl.trim()}
              className="bg-primary hover:bg-primary/80 text-primary-foreground"
            >
              {urlLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {urlLoading ? "Importing..." : "Import"}
            </Button>
          </div>
        )}

        {/* Supported formats hint */}
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>Supported:</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/80">PDF</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/80">DOCX</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/80">TXT</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/80">Images</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/80">Emails</span>
          <span className="px-1.5 py-0.5 rounded bg-secondary/80">CSV/Excel</span>
          <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary">SharePoint URLs</span>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents by name, category, or type..."
            className="pl-10 bg-secondary/50 border-border/50"
          />
        </div>

        {/* Knowledge base tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {["All", ...CATEGORIES].map((kb) => (
            <button
              key={kb}
              onClick={() => setActiveKB(kb)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                activeKB === kb
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-secondary/40 text-muted-foreground border-border/50 hover:text-foreground"
              }`}
            >
              {kb === "All" ? "All Knowledge" : kb}
              <span className="ml-1.5 opacity-70">({kbCounts[kb] ?? 0})</span>
            </button>
          ))}
        </div>

        {/* Documents list */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {filtered.map((doc) => {
            const DocIcon = getDocIcon(doc.file_type);
            return (
              <div
                key={doc.id}
                onClick={() => setPreviewDoc(doc)}
                className={`glass-panel rounded-lg p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-colors ${
                  previewDoc?.id === doc.id ? "border-primary/40 bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <DocIcon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{doc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                        {doc.category}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        {getFileTypeLabel(doc.file_type)}
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
            );
          })}
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
              <span className="text-xs text-muted-foreground">{getFileTypeLabel(previewDoc.file_type)}</span>
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
