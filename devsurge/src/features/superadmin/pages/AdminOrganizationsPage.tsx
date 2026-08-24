import * as React from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { Building2, FileCheck2, CheckCircle2, XCircle, ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { ConfirmActionDialog, ReasonDialog } from "@/components/feedback/ConfirmActionDialog";
import { PlatformAccessGuard } from "@/features/superadmin/components/PlatformAccessGuard";
import {
  usePlatformOrganizations,
  usePlatformOrganizationAuditSummary,
  useSuspendOrganization,
  useReinstateOrganization,
  useArchiveOrganization,
  useOrganizationApplicationsForReview,
  useOrganizationApplicationForReview,
  useApproveOrganizationApplication,
  useRejectOrganizationApplication,
} from "@/features/superadmin/api/queries";
import { toast } from "sonner";

const ORG_STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  SUSPENDED: "bg-destructive/10 text-destructive border-destructive/20",
  ARCHIVED: "bg-muted text-muted-foreground border-border",
};

/**
 * Audit activity for one organization, loaded only when the row is expanded —
 * this is the single aggregate the platform API exposes (cursor pages carry
 * no totals), so it is the only way a superadmin can judge volume rather than
 * page through raw rows.
 */
function OrgAuditSummary({ organizationId }: { organizationId: string }) {
  const { data, isLoading } = usePlatformOrganizationAuditSummary(organizationId);

  if (isLoading) {
    return <div className="px-4 pb-4 text-[11px] text-muted-foreground">Loading activity...</div>;
  }
  if (!data) return null;

  return (
    <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
      <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
        <div className="text-muted-foreground">Total audit events</div>
        <div className="text-base font-bold font-mono text-foreground">{data.totalEvents}</div>
      </div>
      <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
        <div className="text-muted-foreground">First activity</div>
        <div className="font-semibold text-foreground">
          {data.firstEventAt ? new Date(data.firstEventAt).toLocaleDateString() : "—"}
        </div>
        <div className="text-muted-foreground mt-1">Last activity</div>
        <div className="font-semibold text-foreground">
          {data.lastEventAt ? new Date(data.lastEventAt).toLocaleDateString() : "—"}
        </div>
      </div>
      <div className="p-3 rounded-lg border border-border/60 bg-muted/20">
        <div className="text-muted-foreground mb-1">Most frequent actions</div>
        {data.topActions.length === 0 ? (
          <div className="text-muted-foreground">No recorded activity.</div>
        ) : (
          <div className="space-y-0.5">
            {data.topActions.slice(0, 4).map((entry) => (
              <div key={entry.action} className="flex items-center justify-between gap-2">
                <span className="font-mono truncate text-foreground">{entry.action}</span>
                <span className="font-mono text-muted-foreground shrink-0">{entry.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function OrganizationsTab() {
  const { items: orgs, isLoading, hasMore, loadMore, isLoadingMore } = usePlatformOrganizations();
  const suspendMutation = useSuspendOrganization();
  const reinstateMutation = useReinstateOrganization();
  const archiveMutation = useArchiveOrganization();

  const [reasonDialog, setReasonDialog] = React.useState<{ orgId: string; action: "suspend" | "archive" } | null>(null);
  const [expandedOrgId, setExpandedOrgId] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="p-0 divide-y divide-border/60">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
          ) : orgs.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No organizations found.</div>
          ) : (
            orgs.map((org) => (
              <div key={org.id}>
              <div className="p-4 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-bold text-foreground">{org.name}</div>
                  <div className="text-muted-foreground">/{org.slug} · {org.organizationType} · {org.visibility}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 gap-1"
                    onClick={() => setExpandedOrgId((prev) => (prev === org.id ? null : org.id))}
                  >
                    {expandedOrgId === org.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span>Activity</span>
                  </Button>
                  <Badge variant="outline" className={`text-[10px] ${ORG_STATUS_STYLE[org.status] || ""}`}>{org.status}</Badge>
                  {org.status === "ACTIVE" && (
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setReasonDialog({ orgId: org.id, action: "suspend" })}>
                      Suspend
                    </Button>
                  )}
                  {org.status === "SUSPENDED" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => reinstateMutation.mutate({ organizationId: org.id, reason: "Reinstated by platform admin." }, { onSuccess: () => toast.success("Reinstated.") })}
                      >
                        Reinstate
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs h-7 text-destructive" onClick={() => setReasonDialog({ orgId: org.id, action: "archive" })}>
                        Archive
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {expandedOrgId === org.id && <OrgAuditSummary organizationId={org.id} />}
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />

      <ReasonDialog
        open={Boolean(reasonDialog)}
        onOpenChange={(open) => !open && setReasonDialog(null)}
        title={reasonDialog?.action === "suspend" ? "Suspend organization?" : "Archive organization?"}
        description="This is recorded in the audit trail and visible to the organization's own admins."
        reasonPlaceholder="Reason (minimum 10 characters)..."
        confirmLabel={reasonDialog?.action === "suspend" ? "Suspend" : "Archive"}
        loading={suspendMutation.isPending || archiveMutation.isPending}
        onConfirm={(reason) => {
          if (!reasonDialog) return;
          const mutation = reasonDialog.action === "suspend" ? suspendMutation : archiveMutation;
          mutation.mutate(
            { organizationId: reasonDialog.orgId, reason },
            {
              onSuccess: () => { toast.success("Done."); setReasonDialog(null); },
              onError: (err: any) => toast.error(err?.message || "Action failed."),
            },
          );
        }}
      />
    </div>
  );
}

function ApplicationDetail({ applicationId }: { applicationId: string }) {
  const navigate = useNavigate();
  const { data: application, isLoading } = useOrganizationApplicationForReview(applicationId);
  const approveMutation = useApproveOrganizationApplication();
  const rejectMutation = useRejectOrganizationApplication();
  const [confirmApprove, setConfirmApprove] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);

  if (isLoading || !application) {
    return <div className="py-16 text-center text-xs text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin/organization-applications")} className="text-xs h-8 gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to Applications</span>
      </Button>

      <Card className="p-6 border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">{application.name}</h2>
          <Badge variant="outline" className="text-[10px]">{application.status}</Badge>
        </div>
        <div className="text-xs text-muted-foreground">Requested slug: /{application.requestedSlug} · {application.organizationType} · {application.requestedVisibility}</div>
        <p className="text-sm text-foreground">{application.description}</p>
        <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-border/60">
          <div><span className="text-muted-foreground">Requester relationship:</span> {application.requesterRelationship}</div>
          {application.websiteUrl && <div><span className="text-muted-foreground">Website:</span> {application.websiteUrl}</div>}
          {application.country && <div><span className="text-muted-foreground">Country:</span> {application.country}</div>}
          {application.affiliatedInstitution && <div><span className="text-muted-foreground">Institution:</span> {application.affiliatedInstitution}</div>}
        </div>

        {application.status === "PENDING_REVIEW" && (
          <div className="flex items-center gap-2 pt-3 border-t border-border/60">
            <Button size="sm" className="text-xs gap-1.5" disabled={approveMutation.isPending} onClick={() => setConfirmApprove(true)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button variant="outline" size="sm" className="text-xs gap-1.5 text-destructive" onClick={() => setRejectOpen(true)}>
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}
        {application.decisionReason && (
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/60">Decision reason: {application.decisionReason}</div>
        )}
      </Card>

      <ConfirmActionDialog
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title="Approve this application?"
        description="A new organization will be created immediately with the requester as its owner."
        confirmLabel="Approve"
        loading={approveMutation.isPending}
        onConfirm={() =>
          approveMutation.mutate(
            { applicationId },
            {
              onSuccess: () => { toast.success("Application approved."); navigate("/admin/organization-applications"); },
              onError: (err: any) => toast.error(err?.message || "Failed to approve."),
            },
          )
        }
      />
      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="Reject this application?"
        description="The requester will be notified with this reason."
        reasonPlaceholder="Reason (minimum 10 characters)..."
        confirmLabel="Reject"
        loading={rejectMutation.isPending}
        onConfirm={(reason) =>
          rejectMutation.mutate(
            { applicationId, reason },
            {
              onSuccess: () => { toast.success("Application rejected."); setRejectOpen(false); navigate("/admin/organization-applications"); },
              onError: (err: any) => toast.error(err?.message || "Failed to reject."),
            },
          )
        }
      />
    </div>
  );
}

function ApplicationsTab() {
  const navigate = useNavigate();
  const { items: applications, isLoading, hasMore, loadMore, isLoadingMore } = useOrganizationApplicationsForReview();

  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardContent className="p-0 divide-y divide-border/60">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
          ) : applications.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No applications found.</div>
          ) : (
            applications.map((app) => (
              <div
                key={app.id}
                onClick={() => navigate(`/admin/organization-applications/${app.id}`)}
                className="p-4 flex items-center justify-between gap-4 text-xs cursor-pointer hover:bg-accent/40"
              >
                <div>
                  <div className="font-bold text-foreground">{app.name}</div>
                  <div className="text-muted-foreground">/{app.requestedSlug} · {app.organizationType}</div>
                </div>
                <Badge variant="outline" className="text-[10px]">{app.status}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
    </div>
  );
}

export function AdminOrganizationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applicationId } = useParams<{ applicationId: string }>();
  const tab: "organizations" | "applications" = location.pathname.startsWith("/admin/organization-applications") ? "applications" : "organizations";

  if (applicationId) {
    return (
      <PageContainer>
        <PlatformAccessGuard anyOf={["platform.review_applications"]} title="Application Review Restricted" description="Reviewing organization applications requires the platform.review_applications permission — support agents don't hold it.">
          <ApplicationDetail applicationId={applicationId} />
        </PlatformAccessGuard>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Org Vetting & Tenants" description="Review organization applications and manage every tenant on the platform." />

      <PlatformAccessGuard
        anyOf={["platform.manage_organizations", "platform.review_applications"]}
        title="Org Vetting Restricted"
        description="Managing tenants and reviewing applications requires platform.manage_organizations or platform.review_applications — support agents don't hold either."
      >
        <Tabs value={tab} onValueChange={(v: any) => navigate(v === "organizations" ? "/admin/organizations" : "/admin/organization-applications")}>
          <TabsList>
            <TabsTrigger value="organizations" className="text-xs gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Organizations
            </TabsTrigger>
            <TabsTrigger value="applications" className="text-xs gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5" />
              Applications
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "organizations" ? <OrganizationsTab /> : <ApplicationsTab />}
      </PlatformAccessGuard>
    </PageContainer>
  );
}
