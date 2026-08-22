import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, CheckCircle2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { useRedeemJoinCode } from "@/features/participant/api/queries";

export function JoinCodeRedemptionPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [code, setCode] = React.useState("");
  const [result, setResult] = React.useState<{ ok: boolean; message: string; organizationSlug?: string } | null>(null);

  const redeemMutation = useRedeemJoinCode();

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    redeemMutation.mutate(code.trim(), {
      onSuccess: (res) => {
        setResult({ ok: true, message: `You've joined ${res.organizationSlug}.`, organizationSlug: res.organizationSlug });
      },
      onError: (err: any) => {
        setResult({ ok: false, message: err?.message || "That code is invalid, expired, or has reached its redemption limit." });
      },
    });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-16 space-y-8 text-foreground">
      <div className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
          <KeyRound className="h-3.5 w-3.5" />
          <span>Membership Enrollment</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          Redeem Join Code
        </h1>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
          Enter the join code provided by your organization to become a member.
        </p>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-3xl bg-muted/40 border border-border animate-pulse" />
      ) : !isAuthenticated ? (
        <Card className="p-8 rounded-3xl border border-border/80 bg-card text-center space-y-4 shadow-xs">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-foreground">Sign in to redeem a join code</h2>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
              Join codes attach an organization membership to your account.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button onClick={() => navigate(`/auth/signin?returnTo=${encodeURIComponent("/onboarding/join-code")}`)} className="gap-2 font-semibold">
              <span>Sign In</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" onClick={() => navigate(`/auth/signup?returnTo=${encodeURIComponent("/onboarding/join-code")}`)}>
              Create Account
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 sm:p-8 rounded-3xl border border-border/80 bg-card space-y-6 shadow-xs">
          <form onSubmit={handleRedeem} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Join Code</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. APEX-2026-AI"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="font-mono text-xs uppercase h-10"
                  required
                />
                <Button type="submit" disabled={redeemMutation.isPending} className="h-10 text-xs">
                  <span>{redeemMutation.isPending ? "Redeeming..." : "Redeem Code"}</span>
                </Button>
              </div>
            </div>

            {result && (
              <div className={`p-4 rounded-xl text-xs space-y-3 mt-4 ${result.ok ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
                <div className="font-bold flex items-center gap-1.5">
                  {result.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span>{result.message}</span>
                </div>
                {result.ok && (
                  <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-end">
                    <Button size="sm" onClick={() => navigate("/app")} className="text-xs gap-1">
                      <span>Enter Workspace</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </form>
        </Card>
      )}

      <div className="text-center text-xs text-muted-foreground">
        Need to host your own tournaments?{" "}
        <Link to="/app/apply-organization" className="text-primary font-semibold hover:underline">
          Apply to create an Organization
        </Link>
      </div>
    </div>
  );
}
