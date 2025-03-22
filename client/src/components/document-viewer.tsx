import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { FileText, Loader2 } from "lucide-react";

interface DocumentViewerProps {
  document: Document;
}

export default function DocumentViewer({ document }: DocumentViewerProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

  const processOcrMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${document.id}/process-ocr`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to process document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "OCR processing started",
        description: "The document is being processed. This may take a moment.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "OCR processing failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleProcessOcr = (e: React.MouseEvent) => {
    e.preventDefault();
    processOcrMutation.mutate();
  };

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-sm"
        >
          <FileText className="h-4 w-4 mr-2" />
          {isExpanded ? "Hide Content" : "Show Content"}
        </Button>

        {/* Show Process OCR button when appropriate */}
        {(!document.ocrText || document.ocrStatus === "error") && (
          <Button
            onClick={handleProcessOcr}
            disabled={processOcrMutation.isPending || document.ocrStatus === "processing"}
            size="sm"
            variant="outline"
          >
            {processOcrMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Process OCR
          </Button>
        )}
      </div>

      {isExpanded && (
        <div className="space-y-4">
          {/* Show OCR Status */}
          {document.ocrStatus === "processing" && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">
                Processing document...
              </span>
            </div>
          )}

          {document.ocrError && (
            <div className="text-sm text-red-500 p-4 bg-red-50 rounded-md">
              Error processing document: {document.ocrError}
            </div>
          )}

          {document.ocrText && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Document Content</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="prose max-w-none whitespace-pre-wrap text-sm">
                    {document.ocrText}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}