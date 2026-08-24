import * as React from "react";
import { useParams } from "react-router-dom";
import { Search, Download, Code2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useOrgAuditEvents } from "@/features/org-admin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { AuditEvent } from "@/types";

function ActorName({ userId, displayName }: { userId: string | null; displayName?: string | null }) {
  if (!userId) return <>System</>;
  return <>{displayName || userId.slice(0, 8)}</>;
}

function AuditRow({ event }: { event: AuditEvent }) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <Card className="border-border hover:border-primary/40 transition-all overflow-hidden">
      <div onClick={() => setIsExpanded(!isExpanded)} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-muted/20">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] font-mono font-bold uppercase bg-primary/10 text-primary border border-primary/20">
              {event.action}
            </Badge>
            <span className="text-xs font-bold text-foreground">
              <ActorName userId={event.actorUserId} displayName={event.actorDisplayName} />
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{event.summary}</span>
            <span>•</span>
            <span>Target: <span className="font-semibold text-foreground">{event.resourceType}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <span className="text-[11px] text-muted-foreground font-mono">{new Date(event.createdAt).toLocaleString()}</span>
          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {isExpanded && event.changes && (
        <div className="p-4 bg-muted/30 border-t border-border/60 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Code2 className="h-3 w-3" />
            <span>Changes</span>
          </div>
          <pre className="p-3 bg-card border border-border rounded-lg text-[11px] font-mono text-foreground overflow-x-auto">
            {JSON.stringify(event.changes, null, 2)}
          </pre>
        </div>
      )}
    </Card>
  );
}

export function OrgAuditPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { userContext } = useAuth();
  const { items: auditEvents, isLoading, hasMore, loadMore, isLoadingMore } = useOrgAuditEvents(orgId, {
    enabled: can(userContext, "organization.view_audit"),
  });
  const [search, setSearch] = React.useState("");

  const filtered = auditEvents.filter(
    (e) => e.action.toLowerCase().includes(search.toLowerCase()) || e.summary.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${orgId}-${Date.now()}.json`;
    a.click();
  };

  return (
    <OrgAccessGuard permission="organization.view_audit" title="Audit Trail Restricted" description="You require Organization Admin or Organization Owner privileges to inspect the audit log.">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Audit Log"
          description="A record of administrative actions taken in this organization."
          actions={
            <Button variant="outline" size="sm" onClick={handleExportJSON} className="text-xs h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </Button>
          }
        />

        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
          <div className="relative w-full sm:w-80">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by action or summary..." className="pl-8 h-8 text-xs bg-background" />
          </div>
        </div>

        <div className="space-y-3">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-20 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground text-xs border-border">No audit events found.</Card>
          ) : (
            filtered.map((event) => <AuditRow key={event.id} event={event} />)
          )}
        </div>
        <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
      </PageContainer>
    </OrgAccessGuard>
  );
}
