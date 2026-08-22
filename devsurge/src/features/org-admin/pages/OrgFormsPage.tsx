import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useFormDefinitions, useCreateFormDefinition } from "@/features/forms/api/queries";
import { useOrgChallenges } from "@/features/org-admin/api/queries";
import { FormPurpose } from "@/types";
import { toast } from "sonner";

const PURPOSE_LABEL: Record<FormPurpose, string> = {
  ORGANIZATION_JOIN_REQUEST: "Organization Join Request",
  CHALLENGE_PARTICIPATION: "Challenge Participation",
  MENTOR_JUDGE_APPLICATION: "Mentor / Judge Application",
  POST_EVENT_SURVEY: "Post-Event Survey",
  PORTFOLIO_STAGE_GATE: "Portfolio Stage Gate",
};
const PURPOSES = Object.keys(PURPOSE_LABEL) as FormPurpose[];

export function OrgFormsPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [purposeFilter, setPurposeFilter] = React.useState<string>("ALL");
  const { items: forms, isLoading, hasMore, loadMore, isLoadingMore } = useFormDefinitions(orgId, {
    purpose: purposeFilter === "ALL" ? undefined : (purposeFilter as FormPurpose),
  });
  const { items: challenges } = useOrgChallenges(orgId);
  const createMutation = useCreateFormDefinition(orgId);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [purpose, setPurpose] = React.useState<FormPurpose>("CHALLENGE_PARTICIPATION");
  const [challengeId, setChallengeId] = React.useState<string>("NONE");

  const resetForm = () => { setName(""); setPurpose("CHALLENGE_PARTICIPATION"); setChallengeId("NONE"); };

  return (
    <OrgAccessGuard permission="organization.manage_forms" title="Forms Restricted" description="You require Challenge Manager privileges or higher to manage custom forms.">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Custom Forms"
          description="Screening applications, join requests, surveys, and stage-gate forms built from a fixed field catalogue."
          actions={
            <Button size="sm" onClick={() => setCreateOpen(true)} className="text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Form
            </Button>
          }
        />

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs flex items-center gap-2">
          <Select value={purposeFilter} onValueChange={setPurposeFilter}>
            <SelectTrigger className="h-8 text-xs w-64 bg-background">
              <SelectValue placeholder="All Purposes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Purposes</SelectItem>
              {PURPOSES.map((p) => <SelectItem key={p} value={p} className="text-xs">{PURPOSE_LABEL[p]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-20 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
        ) : forms.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed space-y-2">
            <FileText className="h-8 w-8 mx-auto opacity-50" />
            <p>No custom forms yet.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {forms.map((form) => {
              const challenge = challenges.find((c) => c.id === form.challengeId);
              return (
                <Card
                  key={form.id}
                  onClick={() => navigate(`/org/${orgId}/forms/${form.id}`)}
                  className="p-4 border-border hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground truncate">{form.name}</h3>
                      <Badge variant="outline" className="text-[10px]">{PURPOSE_LABEL[form.purpose]}</Badge>
                    </div>
                    {challenge && <div className="text-[11px] text-muted-foreground">Scoped to: {challenge.title}</div>}
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                </Card>
              );
            })}
          </div>
        )}
        <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
      </PageContainer>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">New Form</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Name *</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hackathon Screening Application" className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Purpose *</label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as FormPurpose)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map((p) => <SelectItem key={p} value={p} className="text-xs">{PURPOSE_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Challenge (optional)</label>
              <Select value={challengeId} onValueChange={setChallengeId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Organization-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE" className="text-xs">Organization-wide</SelectItem>
                  {challenges.map((c) => <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} className="text-xs">Cancel</Button>
            <Button
              size="sm"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate(
                  { name: name.trim(), purpose, challengeId: challengeId === "NONE" ? undefined : challengeId },
                  {
                    onSuccess: (created) => {
                      toast.success("Form created.");
                      setCreateOpen(false);
                      resetForm();
                      navigate(`/org/${orgId}/forms/${created.id}`);
                    },
                    onError: (err: any) => toast.error(err?.message || "Failed to create form."),
                  }
                )
              }
              className="text-xs"
            >
              {createMutation.isPending ? "Creating..." : "Create Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OrgAccessGuard>
  );
}
