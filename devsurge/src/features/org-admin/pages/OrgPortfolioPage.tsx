import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layers, Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useInnovationPortfolio, useCreateInnovation } from "@/features/org-admin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { toast } from "sonner";

const STAGE_COLOR: Record<string, string> = {
  DISCOVERY: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30",
  VALIDATION: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30",
  PROTOTYPE: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  PILOT: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  INCUBATION: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/30",
  SCALE: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

export function OrgPortfolioPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { userContext } = useAuth();
  const { items: portfolio, isLoading, hasMore, loadMore, isLoadingMore } = useInnovationPortfolio(orgId, undefined, {
    enabled: can(userContext, "innovation.view"),
  });
  const createMutation = useCreateInnovation(orgId);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [opportunityStatement, setOpportunityStatement] = React.useState("");
  const canManage = can(userContext, "innovation.manage");

  const resetForm = () => { setTitle(""); setOpportunityStatement(""); };

  return (
    <OrgAccessGuard permission="innovation.view" title="Portfolio Restricted" description="You require Challenge Manager privileges or higher to view the innovation portfolio.">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Innovation Portfolio"
          description="Submissions promoted into your organization's innovation pipeline, plus manually tracked opportunities."
          actions={
            canManage ? (
              <Button size="sm" onClick={() => setCreateOpen(true)} className="text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                New Innovation
              </Button>
            ) : undefined
          }
        />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => <div key={n} className="h-48 rounded-2xl bg-muted/40 border border-border animate-pulse" />)}
          </div>
        ) : portfolio.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No innovations yet. Promote a finalized submission from the Submissions Pool, or add one manually.
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {portfolio.map((item) => (
                <Card
                  key={item.id}
                  onClick={() => navigate(`/org/${orgId}/portfolio/${item.id}`)}
                  className="p-5 rounded-2xl border border-border/80 bg-card hover:border-primary/50 transition-all cursor-pointer space-y-3"
                >
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${STAGE_COLOR[item.stage] || "bg-muted text-muted-foreground border-border"}`}>
                    <Sparkles className="h-3 w-3" />
                    {item.stage}
                  </span>
                  <h3 className="text-sm font-bold text-foreground line-clamp-1">{item.title}</h3>
                  {item.opportunityStatement && <p className="text-xs text-muted-foreground line-clamp-2">{item.opportunityStatement}</p>}
                  {item.strategicThemes.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.strategicThemes.slice(0, 3).map((theme) => (
                        <Badge key={theme} variant="outline" className="text-[10px]">{theme}</Badge>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
            <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
          </>
        )}
      </PageContainer>

      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-sm">New Innovation</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Autonomous Grid Balancer" className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Opportunity Statement</label>
              <Textarea value={opportunityStatement} onChange={(e) => setOpportunityStatement(e.target.value)} rows={3} className="text-xs" placeholder="What problem or opportunity does this address?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} className="text-xs">Cancel</Button>
            <Button
              size="sm"
              disabled={!title.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate(
                  { title: title.trim(), opportunityStatement: opportunityStatement.trim() || undefined },
                  {
                    onSuccess: (created) => {
                      toast.success("Innovation created.");
                      setCreateOpen(false);
                      resetForm();
                      navigate(`/org/${orgId}/portfolio/${created.id}`);
                    },
                    onError: (err: any) => toast.error(err?.message || "Failed to create innovation."),
                  }
                )
              }
              className="text-xs"
            >
              {createMutation.isPending ? "Creating..." : "Create Innovation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OrgAccessGuard>
  );
}
