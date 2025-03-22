import { useState } from "react";
import { Document } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface DocumentViewerProps {
  document: Document;
}

export default function DocumentViewer({ document }: DocumentViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpandToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="space-y-4 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={handleExpandToggle}
          className="text-sm"
        >
          <FileText className="h-4 w-4 mr-2" />
          {isExpanded ? "Hide Content" : "Show Content"}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Document Details</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                <div className="prose max-w-none whitespace-pre-wrap text-sm">
                  <p><strong>Name:</strong> {document.name}</p>
                  <p><strong>Category:</strong> {document.category}</p>
                  <p><strong>Tags:</strong> {document.tags.join(', ')}</p>
                  <p><strong>Uploaded:</strong> {new Date(document.uploadedAt).toLocaleString()}</p>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}