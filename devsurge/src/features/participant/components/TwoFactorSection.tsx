import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Copy } from "lucide-react";
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
          <p className="text-xs text-foreground">Scan this in your authenticator app, or enter the secret manually:</p>
          {secret && (
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-muted px-2 py-1.5 rounded border border-border flex-1 break-all">{secret}</code>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => { navigator.clipboard.writeText(secret); toast.success("Secret copied."); }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {enrollment.backupCodes.length > 0 && (
            <div className="text-xs">
              <div className="font-bold text-foreground mb-1">Backup codes (save these somewhere safe):</div>
              <div className="grid grid-cols-2 gap-1 font-mono bg-muted p-2 rounded border border-border">
                {enrollment.backupCodes.map((c) => <span key={c}>{c}</span>)}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="h-9 text-xs w-40" maxLength={6} />
            <Button size="sm" disabled={!code || busy} onClick={handleVerify} className="text-xs">Verify & Activate</Button>
            <Button variant="ghost" size="sm" onClick={() => setEnrollment(null)} className="text-xs">Cancel</Button>
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
