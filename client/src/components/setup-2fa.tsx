import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Setup2FA() {
  const { toast } = useToast();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const setup2FA = async () => {
    try {
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/2fa/setup");
      const data = await res.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
    } catch (error) {
      toast({
        title: "Setup failed",
        description: error instanceof Error ? error.message : "Failed to setup 2FA",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verify2FA = async () => {
    if (!token) return;

    try {
      setIsVerifying(true);
      await apiRequest("POST", "/api/2fa/verify", { token });
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been successfully enabled.",
      });
      // Reset the form
      setQrCode(null);
      setSecret(null);
      setToken("");
    } catch (error) {
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "Invalid verification code",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-Factor Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!qrCode ? (
          <Button
            onClick={setup2FA}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Setup 2FA
          </Button>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
            </div>
            
            <Alert>
              <AlertDescription>
                Scan this QR code with your authenticator app (like Google Authenticator or Authy).
                If you can't scan the code, you can manually enter this secret: {secret}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Button
                onClick={verify2FA}
                disabled={isVerifying || !token}
                className="w-full"
              >
                {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
