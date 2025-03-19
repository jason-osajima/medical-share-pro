import { useQuery } from "@tanstack/react-query";
import { Document } from "@shared/schema";
import NavBar from "@/components/nav-bar";
import DocumentUpload from "@/components/document-upload";
import DocumentSearch from "@/components/document-search";
import AppointmentForm from "@/components/appointment-form";
import Setup2FA from "@/components/setup-2fa";
import ShareDocumentDialog from "@/components/share-document-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileIcon, FolderIcon, Loader2 } from "lucide-react";
import { useState } from "react";

const categories = [
  "Lab Results",
  "Prescriptions",
  "Imaging",
  "Insurance",
  "Other",
];

export default function HomePage() {
  const [searchParams, setSearchParams] = useState({
    query: "",
    category: "",
    tags: [] as string[],
    startDate: null as Date | null,
    endDate: null as Date | null,
  });

  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents", searchParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchParams.query) params.append("query", searchParams.query);
      if (searchParams.category) params.append("category", searchParams.category);
      if (searchParams.tags.length) params.append("tags", JSON.stringify(searchParams.tags));
      if (searchParams.startDate) params.append("startDate", searchParams.startDate.toISOString());
      if (searchParams.endDate) params.append("endDate", searchParams.endDate.toISOString());

      console.log('Fetching documents with params:', Object.fromEntries(params.entries()));
      const response = await fetch(`/api/documents?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    },
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
            <DocumentSearch
              categories={categories}
              onSearch={setSearchParams}
            />

            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                  ) : documents?.length === 0 ? (
                    <div className="text-center text-gray-500">
                      No documents found
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