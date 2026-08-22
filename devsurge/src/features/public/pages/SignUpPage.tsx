import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, User, ArrowRight, ShieldCheck } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";

export function SignUpPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "";
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
