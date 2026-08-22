import * as React from "react";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { PlatformAccessGuard } from "@/features/superadmin/components/PlatformAccessGuard";
import { usePlatformAudit } from "@/features/superadmin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { AuditEvent } from "@/types";

function AuditRow({ event }: { event: AuditEvent }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Card className="border-border hover:border-primary/40 transition-all overflow-hidden">
      <div onClick={() => setExpanded(!expanded)} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-muted/20">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] font-mono font-bold uppercase bg-primary/10 text-primary border border-primary/20">
              {event.action}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{event.actorType}</Badge>
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{event.summary}</span>
            <span>•</span>
            <span>Target: <span className="font-semibold text-foreground">{event.resourceType}</span></span>
            {event.organizationId && (
              <>
                <span>•</span>
                <span className="font-mono">{event.organizationId.slice(0, 8)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
          <span className="text-[11px] text-muted-foreground font-mono">{new Date(event.createdAt).toLocaleString()}</span>
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>
      {expanded && (
        <div className="p-4 bg-muted/30 border-t border-border/60 space-y-1 text-[11px] text-muted-foreground">
          {event.reason && <div><span className="font-bold text-foreground">Reason:</span> {event.reason}</div>}
          {event.changes != null && (
            <pre className="whitespace-pre-wrap font-mono text-[10px] bg-background/60 p-2 rounded border border-border/60">
              {JSON.stringify(event.changes, null, 2)}
            </pre>
          )}
        </div>
      )}
    </Card>
  );
}

export function AdminAuditLogsPage() {
  const { userContext } = useAuth();
  const { items: events, isLoading, hasMore, loadMore, isLoadingMore } = usePlatformAudit(undefined, {
    enabled: can(userContext, "platform.view_audit"),
  });
  const [search, setSearch] = React.useState("");

  const filtered = events.filter(
    (e) => e.action.toLowerCase().includes(search.toLowerCase()) || e.summary.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <PageContainer className="space-y-4">
      <PageHeader title="Global Audit Trail" description="Platform-wide administrative actions across every organization." />

      <PlatformAccessGuard anyOf={["platform.view_audit"]} title="Audit Trail Restricted" description="Viewing the platform-wide audit trail requires the platform.view_audit permission — support agents don't hold it.">
        <div className="p-4 rounded-xl border border-border bg-card shadow-2xs">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by action or summary..." className="h-8 text-xs w-full sm:w-80" />
        </div>

        <div className="space-y-3 mt-4">
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((n) => <div key={n} className="h-20 rounded-xl bg-muted/40 border border-border animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center text-muted-foreground text-xs border-border border-dashed">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No audit events found.
            </Card>
          ) : (
            filtered.map((event) => <AuditRow key={event.id} event={event} />)
          )}
        </div>
        <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
      </PlatformAccessGuard>
    </PageContainer>
  );
}
