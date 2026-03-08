import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DiagramGenerator() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const generateDiagram = async () => {
    setIsLoading(true);
    setImageUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-diagram");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.imageUrl) throw new Error("No image returned");
      setImageUrl(data.imageUrl);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate diagram", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAsJpeg = () => {
    if (!imageUrl || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const jpegUrl = canvas.toDataURL("image/jpeg", 0.95);
      const a = document.createElement("a");
      a.href = jpegUrl;
      a.download = "sopassist-rag-pipeline.jpg";
      a.click();
    };
    img.src = imageUrl;
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            RAG Pipeline Diagram Generator
          </CardTitle>
          <CardDescription>
            Generate an AI-created architecture diagram of the SOPAssist RAG pipeline as a JPEG image.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button onClick={generateDiagram} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Diagram"
              )}
            </Button>
            {imageUrl && (
              <Button variant="outline" onClick={downloadAsJpeg}>
                <Download className="w-4 h-4" />
                Download JPEG
              </Button>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <div className="text-center space-y-3">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
                <p className="text-sm">Generating diagram with AI… this may take 15-30 seconds.</p>
              </div>
            </div>
          )}

          {imageUrl && (
            <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
              <img src={imageUrl} alt="SOPAssist RAG Pipeline Architecture Diagram" className="w-full h-auto" />
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </CardContent>
      </Card>
    </div>
  );
}
