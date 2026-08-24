import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, ArrowRight, KeyRound } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/api/client/authClient";
import { safeReturnTo } from "@/lib/safeReturnTo";

/**
 * Shown when sign-in reports `twoFactorRedirect: true` — the password was
 * correct, but the account has 2FA enrolled and a second factor is
 * required before a full session is granted.
 */
export function TwoFactorVerifyPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  const [mode, setMode] = React.useState<"totp" | "backup">("totp");
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setPending(true);
    setError("");
    try {
      const result =
        mode === "totp"
          ? await authClient.twoFactor.verifyTotp({ code })
          : await authClient.twoFactor.verifyBackupCode({ code });
      if (result.error) {
        setError(result.error.message || "That code didn't work — check it and try again.");
        return;
      }
      navigate(returnTo);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify it's you"
      subtitle={
        mode === "totp"
          ? "Enter the 6-digit code from your authenticator app."
          : "Enter one of your unused backup codes."
      }
    >
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="code" className="text-xs font-semibold">
            {mode === "totp" ? "Authenticator Code" : "Backup Code"}
          </Label>
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="code"
              placeholder={mode === "totp" ? "e.g. 842910" : "e.g. a1b2-c3d4"}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="pl-9 text-center font-mono tracking-widest text-base h-12"
              maxLength={mode === "totp" ? 6 : 12}
              autoFocus
              required
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-10 font-bold text-xs gap-2" disabled={pending}>
          <span>{pending ? "Verifying..." : "Verify & Continue"}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={() => {
            setMode(mode === "totp" ? "backup" : "totp");
            setCode("");
            setError("");
          }}
          className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
        >
          <KeyRound className="h-3 w-3" />
          <span>{mode === "totp" ? "Use a backup code instead" : "Use an authenticator code instead"}</span>
        </button>
      </div>

      <div className="text-center text-xs text-muted-foreground pt-2">
        <Link to="/auth/signin" className="font-bold text-primary hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
