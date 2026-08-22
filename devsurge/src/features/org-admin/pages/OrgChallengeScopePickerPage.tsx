import * as React from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Trophy, FileCheck2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useOrgChallenges } from "@/features/org-admin/api/queries";
import { ChallengeStatusBadge } from "@/components/shared/StatusBadge";
import { getDisplayStatus } from "@/lib/challengeStatus";
import type { Permission } from "@/types/permissions";

interface OrgChallengeScopePickerPageProps {
  /** The challenge-scoped sub-route to land on once a challenge is picked. */
  destination: "submissions" | "judging" | "participants" | "teams" | "announcements";
  title: string;
  description: string;
  icon: typeof FileCheck2;
  permission: Permission;
}

/**
 * "Submissions Pool" and "Judging & Rubrics" are always challenge-scoped on
 * the backend — there is no org-wide submissions/judging resource. The
 * sidebar nav still needs a working top-level entry point for them, so this
 * resolves that ambiguity instead of silently bouncing to the Challenges
 * list (the previous behavior, which made both sidebar items dead clicks):
 * auto-continue straight through when there's exactly one challenge, or show
 * a picker when there's more than one.
 */
export function OrgChallengeScopePickerPage({ destination, title, description, icon: Icon, permission }: OrgChallengeScopePickerPageProps) {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { items: challenges, isLoading } = useOrgChallenges(orgId);

  if (!isLoading && challenges.length === 1) {
    return <Navigate to={`/org/${orgId}/challenges/${challenges[0].id}/${destination}`} replace />;
  }

  return (
    <OrgAccessGuard permission={permission} title={`${title} Restricted`} description="You do not have permission to access this area.">
      <PageContainer className="space-y-6">
        <PageHeader title={title} description={description} />

        {isLoading ? (
          <div className="space-y-3">{[1, 2].map((n) => <div key={n} className="h-20 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
        ) : challenges.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed space-y-3">
            <Icon className="h-8 w-8 mx-auto opacity-50" />
            <p>This organization has no challenges yet.</p>
            <Button size="sm" onClick={() => navigate(`/org/${orgId}/challenges/new`)} className="text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Create a Challenge
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Select a challenge to continue.</p>
            {challenges.map((c) => (
              <Card
                key={c.id}
                onClick={() => navigate(`/org/${orgId}/challenges/${c.id}/${destination}`)}
                className="p-4 border-border hover:border-primary/40 transition-all cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <ChallengeStatusBadge status={getDisplayStatus(c)} />
                  <h3 className="text-sm font-bold text-foreground truncate">{c.title}</h3>
                </div>
                <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
              </Card>
            ))}
          </div>
        )}
      </PageContainer>
    </OrgAccessGuard>
  );
}
