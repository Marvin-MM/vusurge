import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, ArrowRight } from "lucide-react";
import { AuthLayout } from "../components/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/dashboard";
  const { signIn, isAuthenticated } = useAuth();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [awaitingSession, setAwaitingSession] = React.useState(false);

  // In real mode, `signIn()` resolving only means the request succeeded —
  // `useSession()` (Better Auth's client) refetches the session
  // asynchronously afterwards, on its own schedule. Navigating immediately
  // on promise-resolve races that refetch: RequireAuth on the destination
  // route can still see `isAuthenticated: false` and bounce back here. Wait
  // for `isAuthenticated` to actually flip before leaving the page.
  React.useEffect(() => {
    if (awaitingSession && isAuthenticated) {
      navigate(returnTo, { replace: true });
    }
  }, [awaitingSession, isAuthenticated, navigate, returnTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email address and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      if (result.twoFactorRedirect) {
        navigate(`/auth/verify-2fa?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      // Keep the spinner active and let the effect above navigate once the
      // session context has actually caught up.
      setAwaitingSession(true);
    } catch (err: any) {
      setError(err?.message || "Failed to sign in.");
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in to DevArena"
      subtitle="Access your active challenges, team workspaces, or organizer dashboards."
    >
      {error && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-xs text-destructive font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-semibold">
            Work or University Email
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
              autoComplete="email"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-semibold">
              Password
            </Label>
            <Link
              to="/auth/forgot-password"
              className="text-[11px] text-primary hover:underline font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-9 h-10 text-xs"
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-10 font-bold text-xs gap-2" disabled={loading}>
          <span>{loading ? "Authenticating..." : "Sign In to Account"}</span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="text-center text-xs text-muted-foreground pt-2">
        Don't have an account yet?{" "}
        <Link
          to={`/auth/signup?returnTo=${encodeURIComponent(returnTo)}`}
          className="font-bold text-primary hover:underline"
        >
          Create innovator account
        </Link>
      </div>
    </AuthLayout>
  );
}
