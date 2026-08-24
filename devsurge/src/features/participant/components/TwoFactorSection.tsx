import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Copy, Download } from "lucide-react";
import QRCode from "qrcode";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/api/client/authClient";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

function parseSecretFromUri(totpURI: string): string | null {
  try {
    const url = new URL(totpURI);
    return url.searchParams.get("secret");
  } catch {
    return null;
  }
}

function EnrollmentQrCode({ uri }: { uri: string }) {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setSrc(null);
    void QRCode.toDataURL(uri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 220,
      color: { dark: "#020617", light: "#ffffff" },
    }).then((dataUrl) => {
      if (active) setSrc(dataUrl);
    });
    return () => {
      active = false;
    };
  }, [uri]);

  return src ? (
    <img
      src={src}
      alt="QR code containing the authenticator enrollment secret"
      className="h-[220px] w-[220px] rounded-lg border border-border bg-white p-1"
    />
  ) : (
    <div className="h-[220px] w-[220px] rounded-lg border border-border bg-muted animate-pulse" />
  );
}

export function TwoFactorSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const enabled = Boolean(user?.twoFactorEnabled);

  const [password, setPassword] = React.useState("");
  const [enrollment, setEnrollment] = React.useState<{ totpURI: string; backupCodes: string[] } | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const refreshSession = () => queryClient.invalidateQueries({ queryKey: ["auth"] });

  const handleStartEnroll = async () => {
    if (!password) return;
    setBusy(true);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message || "Failed to start 2FA enrollment. Check your password.");
      return;
    }
    setEnrollment(data);
    setPassword("");
  };

  const handleVerify = async () => {
    if (!code) return;
    setBusy(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (error) {
      toast.error(error?.message || "Invalid code.");
      return;
    }
    toast.success("Two-factor authentication enabled.");
    setEnrollment(null);
    setCode("");
    refreshSession();
  };

  const handleDisable = async () => {
    if (!password) return;
    setBusy(true);
    const { error } = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (error) {
      toast.error(error?.message || "Failed to disable 2FA. Check your password.");
      return;
    }
    toast.success("Two-factor authentication disabled.");
    setPassword("");
    refreshSession();
  };

  const secret = enrollment ? parseSecretFromUri(enrollment.totpURI) : null;

  const copyBackupCodes = async () => {
    if (!enrollment) return;
    await navigator.clipboard.writeText(enrollment.backupCodes.join("\n"));
    toast.success("Backup codes copied.");
  };

  const downloadBackupCodes = () => {
    if (!enrollment) return;
    const blob = new Blob(
      [
        "VUSurge two-factor authentication backup codes\n",
        "Each code can be used once. Store these securely.\n\n",
        enrollment.backupCodes.join("\n"),
        "\n",
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "vusurge-2fa-backup-codes.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        {enabled ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <ShieldOff className="h-4 w-4 text-muted-foreground" />}
        <h3 className="text-base font-bold text-foreground">Two-Factor Authentication</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {enabled
          ? "Two-factor authentication is enabled on your account. A verification code will be required at sign-in."
          : "Add an authenticator-app code as a second sign-in factor. This is required for platform superadmin accounts."}
      </p>

      {enrollment ? (
        <div className="space-y-3 pt-2 border-t border-border/60">
          <p className="text-xs text-foreground">Scan this QR code in your authenticator app, then enter the generated code to activate 2FA.</p>
          <div className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-start">
            <EnrollmentQrCode uri={enrollment.totpURI} />
            <div className="space-y-3 min-w-0">
              <p className="text-[11px] text-muted-foreground">
                QR rendering happens locally in this browser. Your enrollment secret is never sent to a QR-code service.
              </p>
              {secret && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold text-foreground">Can't scan it? Enter this setup key:</div>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1.5 rounded border border-border flex-1 break-all">{secret}</code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label="Copy authenticator setup key"
                      onClick={() => { void navigator.clipboard.writeText(secret); toast.success("Setup key copied."); }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          {enrollment.backupCodes.length > 0 && (
            <div className="text-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold text-foreground">Backup codes—save these before activating:</div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => void copyBackupCodes()}>
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={downloadBackupCodes}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1 font-mono bg-muted p-2 rounded border border-border">
                {enrollment.backupCodes.map((c) => <span key={c}>{c}</span>)}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="h-9 text-xs w-40" maxLength={6} />
            <Button type="button" size="sm" disabled={!/^\d{6}$/.test(code) || busy} onClick={handleVerify} className="text-xs">Verify & Activate</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setEnrollment(null); setCode(""); }} className="text-xs">Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-2 border-t border-border/60">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Confirm your password"
            className="h-9 text-xs max-w-64"
          />
          {enabled ? (
            <Button variant="outline" size="sm" disabled={!password || busy} onClick={handleDisable} className="text-xs text-destructive">
              Disable 2FA
            </Button>
          ) : (
            <Button size="sm" disabled={!password || busy} onClick={handleStartEnroll} className="text-xs">
              Enable 2FA
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
