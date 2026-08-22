import * as React from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowRight, CheckCircle2, ChevronLeft } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/api/client/authClient";

export function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    try {
      await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      // Always show the same confirmation regardless of whether the address
      // has an account — existence is never leaked to the caller.
      setSent(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your account email and we'll send you recovery instructions."
    >
      {sent ? (
        <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center space-y-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-foreground">Recovery Instructions Sent</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            If an account exists for <strong>{email}</strong>, you will receive an email with password reset link within 2 minutes.
          </p>
          <div className="pt-2">
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link to="/auth/signin">Return to Sign In</Link>
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold">
              Account Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="innovator@domain.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9 h-10 text-xs"
                required
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-10 font-bold text-xs gap-2"
            disabled={pending}
          >
            <span>{pending ? "Sending..." : "Send Reset Link"}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>

          <div className="text-center pt-2">
            <Link
              to="/auth/signin"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
