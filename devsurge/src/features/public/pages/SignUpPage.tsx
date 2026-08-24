import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, User, ArrowRight, ShieldCheck } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import { safeReturnTo } from "@/lib/safeReturnTo";
import { authClient } from "@/api/client/authClient";

export function SignUpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = requestedReturnTo ? safeReturnTo(requestedReturnTo) : "";
  const inviteToken = searchParams.get("inviteToken") || "";
  const { signUp } = useAuth();

  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [agreeTerms, setAgreeTerms] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setError("Please fill out all required fields.");
      return;
    }
    if (!agreeTerms) {
      setError("You must agree to the Terms of Service and IP Protection Guarantee.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signUp(email, password, fullName, returnTo || undefined);
      if (result.error) {
        setError(result.error);
        return;
      }
      // A real account must confirm its email before continuing — Better
      // Auth already sent the verification link as part of sign-up. The
      // emailed link's own callback (wired in AuthContext.signUp) carries
      // returnTo through to the post-verification landing state below.
      const params = new URLSearchParams({ email });
      if (returnTo) params.set("returnTo", returnTo);
      navigate(`/auth/verify-email?${params.toString()}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your innovator account"
      subtitle="Join verified technology sprints, find teammates, and build funded ventures."
    >
      {inviteToken && (
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>Organization invitation token linked. Your membership will connect automatically.</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-xs font-semibold">
            Full Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              placeholder="Dr. Maya Lin"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="pl-9 h-10 text-xs"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold">
            Work or Academic Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="maya.lin@domain.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9 h-10 text-xs"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-semibold">
            Create Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 h-10 text-xs"
              required
              minLength={8}
            />
          </div>
        </div>

        <div className="flex items-start gap-2 pt-1">
          <input
            id="terms"
            type="checkbox"
            checked={agreeTerms}
            onChange={(e) => setAgreeTerms(e.target.checked)}
            className="mt-1 h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="terms" className="text-[11px] text-muted-foreground leading-snug">
            I agree to the{" "}
            <Link to="/terms" className="text-primary hover:underline" target="_blank">
              Terms of Service
            </Link>{" "}
            and acknowledge the{" "}
            <Link to="/privacy" className="text-primary hover:underline" target="_blank">
              100% Innovator IP Retention Guarantee
            </Link>.
          </label>
        </div>

        <Button type="submit" className="w-full h-10 font-bold text-xs gap-2" disabled={loading}>
          <span>{loading ? "Creating Account..." : "Create Account & Continue"}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-[11px] uppercase tracking-wider font-semibold">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          type="button"
          className="h-10 text-xs font-semibold"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL: returnTo })}
        >
          <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Google
        </Button>
        <Button
          variant="outline"
          type="button"
          className="h-10 text-xs font-semibold"
          onClick={() => authClient.signIn.social({ provider: "github", callbackURL: returnTo })}
        >
          <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          GitHub
        </Button>
      </div>

      <div className="text-center text-xs text-muted-foreground pt-2">
        Already have an account?{" "}
        <Link
          to={`/auth/signin?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-bold text-primary hover:underline"
        >
          Sign in here
        </Link>
      </div>
    </AuthLayout>
  );
}
