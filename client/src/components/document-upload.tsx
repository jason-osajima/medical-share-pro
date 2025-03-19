import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDocumentSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { createWorker } from 'tesseract.js';

const categories = [
  "Lab Results",
  "Prescriptions",
  "Imaging",
  "Insurance",
  "Other",
];

export default function DocumentUpload() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [currentTag, setCurrentTag] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isProcessingOcr, setIsProcessingOcr] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>("");
  const [uploadError, setUploadError] = useState<string | null>(null); //Added state for upload errors

  const form = useForm({
    resolver: zodResolver(insertDocumentSchema),
    defaultValues: {
      name: "",
      category: "",
      tags: [],
      fileUrl: "",
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.message || "Upload failed"; //More specific error handling
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Document uploaded",
        description: "Your document has been uploaded successfully.",
      });
      form.reset();
      setFile(null);
      setTags([]);
      setOcrProgress("");
      setUploadError(null); //Reset upload error
    },
    onError: (error: Error) => {
      setUploadError(error.message); //Set upload error for display
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && currentTag.trim()) {
      e.preventDefault();
      if (!tags.includes(currentTag.trim())) {
        setTags([...tags, currentTag.trim()]);
      }
      setCurrentTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const processOCR = async (file: File): Promise<string> => {
    setIsProcessingOcr(true);
    setOcrProgress("Initializing OCR...");

    try {
      console.log(`Starting OCR process for file: ${file.name}`);
      setOcrProgress("Creating worker...");
      const worker = await createWorker();

      setOcrProgress("Loading language data...");
      console.log("Loading language data...");
      await worker.loadLanguage('eng');

      setOcrProgress("Initializing engine...");
      console.log("Initializing Tesseract...");
      await worker.initialize('eng');

      setOcrProgress("Converting file...");
      console.log("Converting file to data URL...");
      const fileUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      setOcrProgress("Processing text...");
      console.log("Starting text recognition...");
      const { data: { text } } = await worker.recognize(fileUrl);
      console.log("OCR Text extracted:", text ? "Text found" : "No text found");

      setOcrProgress("Cleaning up...");
      await worker.terminate();

      if (!text) {
        throw new Error("No text could be extracted from the document");
      }

      return text;
    } catch (error) {
      console.error('Detailed OCR Error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to process document text');
    } finally {
      setIsProcessingOcr(false);
      setOcrProgress("");
    }
  };

  const onSubmit = async (data: any) => {
    if (!file) return;
    setUploadError(null); //Reset error before upload attempt

    try {
      //File type and size validation
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        throw new Error("File size exceeds the limit (5MB)");
      }
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
        throw new Error("Invalid file type. Only PDF, JPEG, and PNG are supported.");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", data.name);
      formData.append("category", data.category);
      formData.append("tags", JSON.stringify(tags));

      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        try {
          console.log(`Starting OCR for file type: ${file.type}`);
          const ocrText = await processOCR(file);
          console.log("OCR completed successfully");
          formData.append("ocrText", ocrText);
        } catch (ocrError) {
          console.error('OCR Processing Error:', ocrError);
          toast({
            title: "OCR Processing Failed",
            description: "Document will be uploaded without text extraction. " +
              (ocrError instanceof Error ? ocrError.message : "Unknown error occurred"),
            variant: "destructive",
          });
        }
      }

      uploadMutation.mutate(formData);
    } catch (error) {
      console.error('Document Upload Error:', error);
      setUploadError(error instanceof Error ? error.message : "Failed to upload document"); //Set error for display
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload document",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Document</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
              <Input
                type="file"
                className="hidden"
                id="file-upload"
                accept="application/pdf,image/*"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  if (selectedFile) {
                    console.log(`File selected: ${selectedFile.name} (${selectedFile.type})`);
                    setFile(selectedFile);
                  }
                }}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-8 w-8 text-gray-400" />
                <span className="mt-2 text-sm text-gray-600">
                  {file ? file.name : "Click to upload or drag and drop"}
                </span>
                {ocrProgress && (
                  <div className="mt-2 text-sm text-gray-500">
                    {ocrProgress}
                  </div>
                )}
                {uploadError && ( //Display upload error
                  <div className="mt-2 text-sm text-red-500">
                    {uploadError}
                  </div>
                )}
              </label>
            </div>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document Name</FormLabel>
                  <Input {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Tags</FormLabel>
              <Input
                value={currentTag}
                onChange={(e) => setCurrentTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Type a tag and press Enter"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={!file || isProcessingOcr || uploadMutation.isPending}
              className="w-full"
            >
              {(isProcessingOcr || uploadMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isProcessingOcr ? "Processing OCR..." : "Upload Document"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}