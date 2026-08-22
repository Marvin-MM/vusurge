import * as React from "react";
import { useParams } from "react-router-dom";
import { KeyRound, Plus, Copy, Check, Clock, Users, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useOrgJoinCodes, useCreateJoinCode, useRevokeJoinCode } from "@/features/org-admin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { toast } from "sonner";

export function OrgJoinCodesPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { userContext } = useAuth();
  const { data: joinCodes = [], isLoading } = useOrgJoinCodes(orgId, {
    enabled: can(userContext, "organization.manage_join_codes"),
  });
  const createCodeMutation = useCreateJoinCode(orgId);
  const revokeCodeMutation = useRevokeJoinCode(orgId);

  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [maxUses, setMaxUses] = React.useState<number>(100);
  const [expiresInDays, setExpiresInDays] = React.useState<number>(30);
  const [allowedDomains, setAllowedDomains] = React.useState("");
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const [newlyCreatedCode, setNewlyCreatedCode] = React.useState<string | null>(null);

  const handleCreateCode = (e: React.FormEvent) => {
    e.preventDefault();
    createCodeMutation.mutate(
      {
        label: label || undefined,
        maxUses,
        expiresInDays,
        allowedEmailDomains: allowedDomains.split(",").map((d) => d.trim()).filter(Boolean),
      },
      {
        onSuccess: (created) => {
          setCreateDialogOpen(false);
          setLabel("");
          if (created.plaintextCode) setNewlyCreatedCode(created.plaintextCode);
        },
        onError: (err: any) => toast.error(err?.message || "Failed to create join code."),
      }
    );
  };

  const handleCopy = (codeStr: string) => {
    navigator.clipboard?.writeText(codeStr);
    setCopiedCode(codeStr);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRevoke = (codeId: string) => {
    revokeCodeMutation.mutate(codeId, {
      onSuccess: () => toast.success("Join code revoked."),
      onError: (err: any) => toast.error(err?.message || "Failed to revoke join code."),
    });
  };

  return (
    <OrgAccessGuard
      permission="organization.manage_join_codes"
      title="Join Code Management Restricted"
      description="You require Organization Admin privileges to create and manage join codes."
    >
      <PageContainer className="space-y-6">
        <PageHeader
          title="Organization Join Codes"
          description="Distribute codes that let people join your organization directly, without an individual invitation."
          actions={
            <Button onClick={() => setCreateDialogOpen(true)} className="text-xs font-semibold gap-1.5 h-8 shadow-xs">
              <Plus className="h-3.5 w-3.5" />
              <span>Generate Join Code</span>
            </Button>
          }
        />

        {newlyCreatedCode && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <div className="font-bold text-foreground">
                  Code created: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{newlyCreatedCode}</code>
                </div>
                <div className="text-muted-foreground">Copy this now — it won't be shown again.</div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleCopy(newlyCreatedCode)} className="text-xs h-8 gap-1.5 shrink-0">
              {copiedCode === newlyCreatedCode ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              <span>Copy</span>
            </Button>
          </div>
        )}

        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-sm font-bold">Join Codes</CardTitle>
              <CardDescription className="text-xs">
                Redeemed at <code className="font-mono bg-muted px-1 rounded">/onboarding/join-code</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
              ) : joinCodes.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground text-xs">No join codes created yet.</div>
              ) : (
                joinCodes.map((jc) => {
                  const isExpired = jc.expiresAt ? new Date(jc.expiresAt).getTime() < Date.now() : false;
                  return (
                    <div key={jc.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/20 transition-colors">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{jc.label || "Untitled Code"}</span>
                          <Badge variant="secondary" className={`text-[10px] font-mono ${!jc.revoked && !isExpired ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-muted text-muted-foreground"}`}>
                            {jc.revoked ? "REVOKED" : isExpired ? "EXPIRED" : "ACTIVE"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {jc.useCount}{jc.maxUses ? ` of ${jc.maxUses}` : ""} redeemed
                          </span>
                          {jc.expiresAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires {new Date(jc.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={jc.revoked || revokeCodeMutation.isPending}
                          onClick={() => handleRevoke(jc.id)}
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          title="Revoke join code"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Generate New Join Code
              </DialogTitle>
              <DialogDescription className="text-xs">A code will be generated for you — it's shown once on creation.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateCode} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Label</label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Stanford Cohort 2026" className="text-xs h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Max Redemptions</label>
                  <Input type="number" value={maxUses} onChange={(e) => setMaxUses(Number(e.target.value))} min={1} max={10000} className="text-xs h-9" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Expires In (Days)</label>
                  <Input type="number" value={expiresInDays} onChange={(e) => setExpiresInDays(Number(e.target.value))} min={1} className="text-xs h-9" required />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Allowed Email Domains (Optional)</label>
                <Input value={allowedDomains} onChange={(e) => setAllowedDomains(e.target.value)} placeholder="stanford.edu, mit.edu" className="text-xs h-9" />
              </div>

              <DialogFooter className="pt-2">
                <Button variant="ghost" size="sm" type="button" onClick={() => setCreateDialogOpen(false)} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={createCodeMutation.isPending} className="text-xs font-semibold px-4">
                  {createCodeMutation.isPending ? "Generating..." : "Generate Code"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </OrgAccessGuard>
  );
}
