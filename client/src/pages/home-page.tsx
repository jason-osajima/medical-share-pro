import { useQuery } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import NavBar from "@/components/nav-bar";
import DocumentUpload from "@/components/document-upload";
import AppointmentForm from "@/components/appointment-form";
import Setup2FA from "@/components/setup-2fa";
import ShareDocumentDialog from "@/components/share-document-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon, FolderIcon } from "lucide-react";

export default function HomePage() {
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <DocumentUpload />
            <AppointmentForm />
            <Setup2FA />
          </div>

          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Recent Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {isLoading ? (
                    <div className="text-center text-gray-500">Loading...</div>
                  ) : documents?.length === 0 ? (
                    <div className="text-center text-gray-500">
                      No documents uploaded yet
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {documents?.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-start gap-3 p-3 rounded-lg border"
                        >
                          <div className="p-2 bg-gray-100 rounded">
                            <FileIcon className="h-5 w-5 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium">{doc.name}</h3>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                              <FolderIcon className="h-4 w-4" />
                              {doc.category}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {doc.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <ShareDocumentDialog documentId={doc.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}