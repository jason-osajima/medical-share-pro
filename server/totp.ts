import speakeasy from "speakeasy";
import QRCode from "qrcode";

export function generateTotpSecret() {
  return speakeasy.generateSecret({
    name: "MedDocs",
    issuer: "MedDocs App",
  });
}

export function verifyTotp(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
  });
}

export async function generateQrCodeUrl(secret: speakeasy.GeneratedSecret): Promise<string> {
  return await QRCode.toDataURL(secret.otpauth_url || "");
}
