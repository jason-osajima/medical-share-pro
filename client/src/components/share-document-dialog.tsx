import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ShareLink } from "@shared/schema";
import { Loader2, Share2, Copy, Link } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ShareDocumentDialogProps {
  documentId: number;
}

export default function ShareDocumentDialog({ documentId }: ShareDocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [expiresInDays, setExpiresInDays] = useState<string>("never");
  const [maxAccesses, setMaxAccesses] = useState<string>("unlimited");

  const { data: shareLinks, isLoading } = useQuery<(ShareLink & { url: string })[]>({
    queryKey: [`/api/documents/${documentId}/share`],
    enabled: isOpen,
  });

  const createShareMutation = useMutation({
    mutationFn: async (data: { expiresInDays?: number; maxAccesses?: number }) => {
      const res = await apiRequest(
        "POST",
        `/api/documents/${documentId}/share`,
        data
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/documents/${documentId}/share`],
      });
      toast({
        title: "Share link created",
        description: "You can now share this document with others",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create share link",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Copied to clipboard",
        description: "Share link has been copied",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Please try copying manually",
        variant: "destructive",
      });
    }
  };

  const handleCreateLink = () => {
    createShareMutation.mutate({
      expiresInDays: expiresInDays === "never" ? undefined : parseInt(expiresInDays),
      maxAccesses: maxAccesses === "unlimited" ? undefined : parseInt(maxAccesses),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Expires In</Label>
            <Select
              value={expiresInDays}
              onValueChange={setExpiresInDays}
            >
              <SelectTrigger>
                <SelectValue placeholder="Never" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Maximum Access Count</Label>
            <Select
              value={maxAccesses}
              onValueChange={setMaxAccesses}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unlimited" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unlimited">Unlimited</SelectItem>
                <SelectItem value="1">1 time</SelectItem>
                <SelectItem value="5">5 times</SelectItem>
                <SelectItem value="10">10 times</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleCreateLink}
            disabled={createShareMutation.isPending}
            className="w-full"
          >
            {createShareMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Share Link
          </Button>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : shareLinks?.length ? (
            <div className="space-y-2">
              <Label>Existing Share Links</Label>
              {shareLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-2 p-2 border rounded"
                >
                  <Link className="h-4 w-4 text-gray-500" />
                  <Input
                    value={link.url}
                    readOnly
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(link.url)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}