import { useQuery } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileIcon, FolderIcon } from "lucide-react";
import { useParams } from "wouter";

export default function SharedDocumentPage() {
  const { token } = useParams();
  const { data: document, isLoading, error } = useQuery<Document>({
    queryKey: [`/api/shared/${token}`],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">Loading document...</div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              Document not found or link has expired
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Shared Document</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-3">
              <div className="p-2 bg-gray-100 rounded">
                <FileIcon className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium text-xl">{document.name}</h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                  <FolderIcon className="h-4 w-4" />
                  {document.category}
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {document.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                {/* Add document viewer or download link here */}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
