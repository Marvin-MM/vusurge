import * as React from "react";
import { Activity, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { usePlatformHealth } from "@/features/superadmin/api/queries";

const STATUS_STYLE: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  degraded: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  down: "bg-destructive/10 text-destructive border-destructive/20",
};

export function AdminHealthPage() {
  const { data: health, isLoading, refetch, isFetching } = usePlatformHealth();

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Infrastructure Telemetry"
        description="Live dependency health from the API's own readiness probe."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="text-xs h-8 gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => <div key={n} className="h-24 rounded-xl bg-muted/40 border border-border animate-pulse" />)}
        </div>
      ) : !health ? (
        <Card className="p-8 text-center text-xs text-destructive border-destructive/20">
          <XCircle className="h-6 w-6 mx-auto mb-2" />
          Health endpoint unreachable.
        </Card>
      ) : (
        <>
          <Card className="border-border p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${health.status === "ready" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"}`}>
                {health.status === "ready" ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{health.service}</div>
                <div className="text-xs text-muted-foreground">v{health.version}</div>
              </div>
            </div>
            <Badge variant="outline" className={`text-[10px] ${health.status === "ready" ? STATUS_STYLE.ok : STATUS_STYLE.down}`}>
              {health.status.toUpperCase()}
            </Badge>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {health.dependencies.map((dep) => (
              <Card key={dep.name} className="border-border">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Activity className="h-3.5 w-3.5 text-primary" />{dep.name}</span>
                    <Badge variant="outline" className={`text-[9px] ${STATUS_STYLE[dep.status] || ""}`}>{dep.status}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-xs text-muted-foreground space-y-0.5">
                  <div>{dep.required ? "Required" : "Optional"} dependency</div>
                  {dep.latencyMs != null && <div>{dep.latencyMs}ms latency</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}
