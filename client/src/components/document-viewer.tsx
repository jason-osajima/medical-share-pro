import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentViewerProps {
  document: Document;
}

export default function DocumentViewer({ document }: DocumentViewerProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-left"
        >
          <FileText className="h-4 w-4 mr-2" />
          {isExpanded ? "Hide Content" : "Show Content"}
        </Button>
        {document.ocrText && !document.summary && document.summaryStatus !== "processing" && (
          <Button
            onClick={() => summarizeMutation.mutate()}
            disabled={summarizeMutation.isPending}
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
          {document.summary && (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="prose max-w-none">
                    {document.summary}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {document.ocrText && (
            <Card>
              <CardHeader>
                <CardTitle>Document Content</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="prose max-w-none whitespace-pre-wrap">
                    {document.ocrText}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {document.summaryStatus === "processing" && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-600">Generating summary...</span>
            </div>
          )}

          {document.summaryError && (
            <div className="text-red-500">
              Error generating summary: {document.summaryError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}