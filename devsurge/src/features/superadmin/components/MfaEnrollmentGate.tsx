/**
 * MfaEnrollmentGate
 *
 * Shown to a PLATFORM_SUPERADMIN who has not yet enrolled in two-factor
 * authentication. The gate blocks access to every platform-admin page and
 * forces enrollment before proceeding.
 *
 * It mirrors the logic in TwoFactorSection (account settings) but is:
 *   - mandatory (no opt-out)
 *   - presented full-screen with platform-admin chrome
 *   - only rendered inside the PlatformAdminShell, never for other portals
 *
 * Flow:
 *   1. User enters their password → backend generates TOTP URI + backup codes.
 *   2. User scans QR code in their authenticator app.
 *   3. User enters the 6-digit code → backend marks twoFactorEnabled = true.
 *   4. Auth session query is invalidated → user gains MFA assurance → portal unlocks.
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, ShieldCheck, Copy, Download, AlertCircle } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/api/client/authClient";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseSecretFromUri(totpURI: string): string | null {
  try {
    return new URL(totpURI).searchParams.get("secret");
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
      width: 240,
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
      alt="QR code for authenticator app enrollment"
      className="h-[240px] w-[240px] rounded-xl border border-amber-500/30 bg-white p-1.5 shadow-lg"
    />
  ) : (
    <div className="h-[240px] w-[240px] rounded-xl border border-amber-500/30 bg-muted animate-pulse" />
  );
}

// ---------------------------------------------------------------------------
// Step components
// ---------------------------------------------------------------------------

type Step = "password" | "scan" | "done";

interface Enrollment {
  totpURI: string;
  backupCodes: string[];
}

function StepPassword({
  onSuccess,
}: {
  onSuccess: (data: Enrollment) => void;
}) {
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (error || !data) {
      toast.error(error?.message ?? "Failed to start enrollment. Check your password.");
      return;
    }
    onSuccess(data as Enrollment);
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <p className="text-sm text-slate-300">
        To generate your authenticator QR code, confirm your account password first.
      </p>
      <div className="space-y-2">
        <label htmlFor="mfa-gate-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Account Password
        </label>
        <Input
          id="mfa-gate-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
          className="h-10 bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus-visible:ring-amber-500"
          autoFocus
        />
      </div>
      <Button
        type="submit"
        disabled={!password || busy}
        className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
      >
        {busy ? "Generating…" : "Generate QR Code →"}
      </Button>
    </form>
  );
}

function StepScan({
  enrollment,
  onSuccess,
}: {
  enrollment: Enrollment;
  onSuccess: () => void;
}) {
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const secret = parseSecretFromUri(enrollment.totpURI);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    setBusy(true);
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    setBusy(false);
    if (error) {
      toast.error(error?.message ?? "Invalid code. Try again.");
      return;
    }
    toast.success("Two-factor authentication enabled!");
    onSuccess();
  };

  const copyBackupCodes = async () => {
    await navigator.clipboard.writeText(enrollment.backupCodes.join("\n"));
    toast.success("Backup codes copied to clipboard.");
  };

  const downloadBackupCodes = () => {
    const blob = new Blob(
      [
        "VUSurge Platform Admin — two-factor authentication backup codes\n",
        "Each code can be used once. Store these somewhere safe.\n\n",
        enrollment.backupCodes.join("\n"),
        "\n",
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vusurge-admin-2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form onSubmit={(e) => void handleVerify(e)} className="space-y-6">
      {/* QR + secret key side-by-side on wide screens */}
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <EnrollmentQrCode uri={enrollment.totpURI} />

        <div className="space-y-4 min-w-0 flex-1">
          <p className="text-sm text-slate-300">
            Open your authenticator app (Google Authenticator, Authy, 1Password, etc.) and scan the QR code to add your account.
          </p>
          {secret && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Can't scan? Enter this setup key:
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono bg-slate-800 border border-slate-700 px-2 py-1.5 rounded flex-1 break-all text-amber-300">
                  {secret}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0 border-slate-700 bg-slate-800 hover:bg-slate-700"
                  aria-label="Copy authenticator setup key"
                  onClick={() => {
                    void navigator.clipboard.writeText(secret);
                    toast.success("Setup key copied.");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 text-slate-300" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backup codes */}
      {enrollment.backupCodes.length > 0 && (
        <div className="space-y-2 bg-slate-800/60 border border-amber-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-bold text-amber-400">
              ⚠ Save your backup codes before activating:
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                onClick={() => void copyBackupCodes()}
              >
                <Copy className="h-3 w-3" /> Copy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px] gap-1 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                onClick={downloadBackupCodes}
              >
                <Download className="h-3 w-3" /> Download
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1 font-mono text-xs text-slate-300">
            {enrollment.backupCodes.map((c) => (
              <span key={c} className="bg-slate-900 px-2 py-0.5 rounded">{c}</span>
            ))}
          </div>
        </div>
      )}

      {/* Verification code entry */}
      <div className="space-y-2">
        <label htmlFor="mfa-gate-totp" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Verify — Enter the 6-digit code from your app
        </label>
        <div className="flex items-center gap-3">
          <Input
            id="mfa-gate-totp"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
            className="h-10 w-36 text-center font-mono tracking-widest text-lg bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-600 focus-visible:ring-amber-500"
            autoFocus
          />
          <Button
            type="submit"
            disabled={!/^\d{6}$/.test(code) || busy}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold"
          >
            {busy ? "Verifying…" : "Activate 2FA"}
          </Button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Public gate component
// ---------------------------------------------------------------------------

interface MfaEnrollmentGateProps {
  /** Email of the current user — shown for context. */
  email: string | undefined;
}

export function MfaEnrollmentGate({ email }: MfaEnrollmentGateProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = React.useState<Step>("password");
  const [enrollment, setEnrollment] = React.useState<Enrollment | null>(null);

  const handleEnrollmentStarted = (data: Enrollment) => {
    setEnrollment(data);
    setStep("scan");
  };

  const handleEnrollmentComplete = () => {
    setStep("done");
    // Invalidate the auth session so twoFactorEnabled flips to true
    // and the shell re-renders into the normal portal view.
    void queryClient.invalidateQueries({ queryKey: ["auth"] });
    void queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
              {step === "done" ? (
                <ShieldCheck className="h-10 w-10 text-amber-400" />
              ) : (
                <Shield className="h-10 w-10 text-amber-400" />
              )}
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              {step === "done" ? "You're all set!" : "Set Up Two-Factor Authentication"}
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {step === "done"
                ? "2FA is now active on your account. The platform portal is loading…"
                : "Two-factor authentication is required for all platform superadmin accounts before accessing the portal."}
            </p>
          </div>
          {email && step !== "done" && (
            <div className="text-xs text-slate-500">
              Signing in as <span className="text-slate-300 font-medium">{email}</span>
            </div>
          )}
        </div>

        {/* Step indicator */}
        {step !== "done" && (
          <div className="flex items-center justify-center gap-2">
            {(["password", "scan"] as Step[]).map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold transition-colors ${
                    step === s
                      ? "bg-amber-500 text-slate-950"
                      : i < (step === "scan" ? 1 : 0)
                      ? "bg-amber-500/30 text-amber-400"
                      : "bg-slate-800 text-slate-500"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 1 && (
                  <div className={`h-px w-8 transition-colors ${step === "scan" ? "bg-amber-500/40" : "bg-slate-700"}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Notice */}
        {step === "password" && (
          <div className="flex gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Platform superadmin access requires two-factor authentication. This setup only needs to be completed once. Use any TOTP-compatible authenticator app such as Google Authenticator, Authy, or 1Password.
            </p>
          </div>
        )}

        {/* Step content */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          {step === "password" && (
            <StepPassword onSuccess={handleEnrollmentStarted} />
          )}
          {step === "scan" && enrollment && (
            <StepScan enrollment={enrollment} onSuccess={handleEnrollmentComplete} />
          )}
          {step === "done" && (
            <div className="text-center py-4 text-sm text-slate-300">
              Refreshing your session…
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600">
          You can manage your 2FA settings later from <span className="text-slate-500">Account Settings → Security</span>.
        </p>
      </div>
    </div>
  );
}
