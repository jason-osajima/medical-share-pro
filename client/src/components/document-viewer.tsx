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
        method: "POST"
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

  const summarizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/documents/${document.id}/summarize`, {
        method: "POST"
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to summarize document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document summarized",
        description: "The summary has been generated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Summarization failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
        {/* Add Process OCR button */}
        {(document.ocrStatus === "pending" || document.ocrStatus === "error") && (
          <Button
            onClick={() => processOcrMutation.mutate()}
            disabled={processOcrMutation.isPending}
            size="sm"
          >
            {processOcrMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Process OCR
          </Button>
        )}
        {document.ocrText && !document.summary && document.summaryStatus !== "processing" && (
          <Button
            onClick={() => summarizeMutation.mutate()}
            disabled={summarizeMutation.isPending}
            size="sm"
          >
            {summarizeMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Generate Summary
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
            <div className="text-sm text-red-500">
              Error processing document: {document.ocrError}
            </div>
          )}

          {document.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="prose max-w-none text-sm">
                    {document.summary}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
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

          {document.summaryStatus === "processing" && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-600">
                Generating summary...
              </span>
            </div>
          )}

          {document.summaryError && (
            <div className="text-sm text-red-500">
              Error generating summary: {document.summaryError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}