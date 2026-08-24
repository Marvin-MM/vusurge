import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MailCheck, RefreshCw, CheckCircle2, ArrowRight } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "@/components/ui/button";
import { authClient } from "@/api/client/authClient";
import { safeReturnTo } from "@/lib/safeReturnTo";

/**
 * Better Auth verifies email via a signed LINK in the email itself (opened
 * directly, not typed in) — there is no 6-digit code to enter here. This
 * page is a holding screen shown right after sign-up (and reachable again
 * via a resend), plus the landing state once the emailed link's own
 * redirect (`callbackURL`) sends the user back with `?verified=true`.
 */
export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const verified = searchParams.get("verified") === "true";
  const returnTo = safeReturnTo(searchParams.get("returnTo"));

  const [resendState, setResendState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");

  const handleResend = async () => {
    if (!email) return;
    setResendState("sending");
    try {
      const params = new URLSearchParams({ verified: "true" });
      if (returnTo && returnTo !== "/app") params.set("returnTo", returnTo);
      await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.origin}/auth/verify-email?${params.toString()}`,
      });
      setResendState("sent");
    } catch {
      setResendState("error");
    }
  };

  if (verified) {
    return (
      <AuthLayout title="Email verified" subtitle="Your account is fully confirmed.">
        <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-foreground">Email Verified!</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            You're all set. Continue whenever you're ready.
          </p>
          <Button asChild size="sm" className="text-xs gap-1.5">
            <Link to={returnTo}>
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Check your inbox"
      subtitle={email ? `We've sent a confirmation link to ${email}` : "We've sent a confirmation link to your email address."}
    >
      <div className="p-6 rounded-2xl border border-border bg-muted/30 text-center space-y-3">
        <MailCheck className="h-8 w-8 text-primary mx-auto" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Open the email and click the confirmation link to verify your account. You can close this
          tab — the link works on its own.
        </p>
      </div>

      {email && (
        <div className="text-center pt-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={resendState === "sending"}
            className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${resendState === "sending" ? "animate-spin" : ""}`} />
            <span>
              {resendState === "sent"
                ? "Verification email resent"
                : resendState === "error"
                  ? "Couldn't resend — try again"
                  : "Resend verification email"}
            </span>
          </button>
        </div>
      )}

      <div className="text-center text-xs text-muted-foreground pt-2">
        Wrong account?{" "}
        <Link to="/auth/signin" className="font-bold text-primary hover:underline">
          Sign in again
        </Link>
      </div>
    </AuthLayout>
  );
}
