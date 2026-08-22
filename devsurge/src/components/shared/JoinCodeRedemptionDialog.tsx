import * as React from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRedeemJoinCode } from "@/features/participant/api/queries";

export interface JoinCodeRedemptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** The redemption form for an already-authenticated user, wherever it's
 * triggered from — as opposed to `JoinCodeRedemptionPage`, which stays a
 * full page reserved for the onboarding flow (`/onboarding/join-code`,
 * reachable by signed-out visitors who need the sign-in prompt first). */
export function JoinCodeRedemptionDialog({ open, onOpenChange }: JoinCodeRedemptionDialogProps) {
  const navigate = useNavigate();
  const [code, setCode] = React.useState("");
  const [result, setResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const redeemMutation = useRedeemJoinCode();

  React.useEffect(() => {
    if (open) {
      setCode("");
      setResult(null);
    }
  }, [open]);

  const handleRedeem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    redeemMutation.mutate(code.trim(), {
      onSuccess: (res) => setResult({ ok: true, message: `You've joined ${res.organizationSlug}.` }),
      onError: (err: any) =>
        setResult({ ok: false, message: err?.message || "That code is invalid, expired, or has reached its redemption limit." }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Redeem Join Code
          </DialogTitle>
          <DialogDescription className="text-xs">
            Enter the join code provided by your organization to become a member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleRedeem} className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Join Code</Label>
            <Input
              placeholder="e.g. APEX-2026-AI"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono text-xs uppercase h-10"
              autoFocus
              required
            />
          </div>

          {result && (
            <div className={`p-3 rounded-lg text-xs space-y-2 ${result.ok ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300" : "bg-destructive/10 border border-destructive/20 text-destructive"}`}>
              <div className="font-bold flex items-center gap-1.5">
                {result.ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                <span>{result.message}</span>
              </div>
            </div>
          )}

          <DialogFooter className="pt-1">
            {result?.ok ? (
              <Button type="button" size="sm" onClick={() => { onOpenChange(false); navigate("/app"); }} className="text-xs gap-1.5 w-full">
                <span>Enter Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={redeemMutation.isPending || !code.trim()} className="text-xs">
                  {redeemMutation.isPending ? "Redeeming..." : "Redeem Code"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
