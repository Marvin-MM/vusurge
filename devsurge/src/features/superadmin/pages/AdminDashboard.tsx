import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ShieldAlert, LifeBuoy, History, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import {
  useOrganizationApplicationsForReview,
  usePlatformReports,
  usePlatformSupportTickets,
  usePlatformAudit,
} from "@/features/superadmin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";

export function AdminDashboard() {
  const navigate = useNavigate();
  const { userContext } = useAuth();
  // PLATFORM_SUPPORT_AGENT holds only platform.support + platform.moderate
  // (see roles.ts) — a strict subset of PLATFORM_SUPERADMIN's permissions.
  // Applications review and the audit trail are superadmin-only; fetching
  // them unconditionally 403s for a support agent and shows a misleading
  // "0 pending" instead of "you can't see this."
  const canReviewApplications = can(userContext, "platform.review_applications");
  const canViewAudit = can(userContext, "platform.view_audit");
  const { items: applications, isLoading: loadingApplications } = useOrganizationApplicationsForReview("PENDING_REVIEW", {
    enabled: canReviewApplications,
  });
  const { items: reports, isLoading: loadingReports } = usePlatformReports("OPEN");
  const { items: tickets, isLoading: loadingTickets } = usePlatformSupportTickets({ status: "OPEN" });
  const { items: audit, isLoading: loadingAudit } = usePlatformAudit(undefined, { enabled: canViewAudit });

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Global Overview" description="Cross-tenant governance and operational status for the platform." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {canReviewApplications && (
          <Card className="border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/organizations")}>
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Pending Applications
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {loadingApplications ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
              ) : applications.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No pending applications.</div>
              ) : (
                applications.slice(0, 5).map((a) => (
                  <div key={a.id} className="p-3 text-xs flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground truncate">{a.name}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">{a.organizationType}</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}

        <Card className="border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/moderation")}>
          <CardHeader className="p-4 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-primary" />
              Open Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {loadingReports ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
            ) : reports.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No open reports.</div>
            ) : (
              reports.slice(0, 5).map((r) => (
                <div key={r.id} className="p-3 text-xs flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground truncate">{r.category.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{r.targetType}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border cursor-pointer hover:border-primary/50 transition-colors" onClick={() => navigate("/admin/support")}>
          <CardHeader className="p-4 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-primary" />
              Open Tickets
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {loadingTickets ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
            ) : tickets.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No open tickets.</div>
            ) : (
              tickets.slice(0, 5).map((t) => (
                <div key={t.id} className="p-3 text-xs flex items-center justify-between gap-2">
                  <span className="font-bold text-foreground truncate">{t.subject}</span>
                  <Badge variant="outline" className="text-[10px] shrink-0">{t.priority}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {canViewAudit && (
        <Card className="border-border">
          <CardHeader className="p-4 border-b border-border/60 flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Recent Platform Activity
            </CardTitle>
            <button onClick={() => navigate("/admin/audit-logs")} className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {loadingAudit ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
            ) : audit.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">No recent activity.</div>
            ) : (
              audit.slice(0, 8).map((e) => (
                <div key={e.id} className="p-3 text-xs flex items-center justify-between gap-4">
                  <span className="text-foreground">{e.summary}</span>
                  <span className="text-muted-foreground shrink-0">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
