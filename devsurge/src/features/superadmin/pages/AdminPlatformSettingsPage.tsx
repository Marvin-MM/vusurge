import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { PlatformAccessGuard } from "@/features/superadmin/components/PlatformAccessGuard";
import { usePlatformSettings } from "@/features/superadmin/api/queries";

function bytes(value: number): string {
  return value >= 1024 * 1024 ? `${(value / (1024 * 1024)).toFixed(1)} MiB` : `${Math.round(value / 1024)} KiB`;
}

function AdminPlatformSettingsContent() {
  const { data, isLoading } = usePlatformSettings();
  if (isLoading || !data) return <PageContainer><div className="h-48 rounded-xl bg-muted/40 animate-pulse" /></PageContainer>;

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Platform Settings" description="Non-secret deployment policy currently active on the API process." />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5 space-y-4">
          <h3 className="font-bold text-sm">Deployment</h3>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Environment</span><Badge variant="outline">{data.environment}</Badge></div>
          <div className="flex justify-between text-xs"><span className="text-muted-foreground">Service version</span><span className="font-mono">{data.serviceVersion}</span></div>
          <p className="text-[11px] text-muted-foreground border-t pt-3">Feature flags are environment-controlled and restart-bound by design. Production changes should go through deployment configuration and change review, not an unaudited runtime toggle.</p>
        </Card>
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-sm">Security policy</h3>
          <div className="flex justify-between text-xs"><span>Session lifetime</span><span>{Math.round(data.security.sessionExpiresInSeconds / 3600)} hours</span></div>
          <div className="flex justify-between text-xs"><span>Fresh-session window</span><span>{Math.round(data.security.freshSessionMaxAgeSeconds / 60)} minutes</span></div>
          <div className="flex justify-between text-xs"><span>Rate limiting</span><Badge variant="outline">{data.security.rateLimitingEnabled ? "Enabled" : "Disabled"}</Badge></div>
          <div className="flex justify-between text-xs"><span>High-risk fail closed</span><Badge variant="outline">{data.security.failClosedOnHighRisk ? "Enabled" : "Disabled"}</Badge></div>
          <div className="flex justify-between text-xs"><span>Deletion grace period</span><span>{data.security.accountDeletionGraceDays} days</span></div>
        </Card>
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-sm">Feature flags</h3>
          {Object.entries(data.featureFlags).sort(([a], [b]) => a.localeCompare(b)).map(([name, enabled]) => (
            <div key={name} className="flex justify-between gap-4 text-xs"><span className="font-mono break-all">{name}</span><Badge variant={enabled ? "default" : "outline"}>{enabled ? "On" : "Off"}</Badge></div>
          ))}
        </Card>
        <Card className="p-5 space-y-3">
          <h3 className="font-bold text-sm">Request and upload limits</h3>
          <div className="flex justify-between text-xs"><span>Request body</span><span>{bytes(data.limits.maxRequestBodyBytes)}</span></div>
          <div className="flex justify-between text-xs"><span>Images</span><span>{bytes(data.limits.maxImageBytes)}</span></div>
          <div className="flex justify-between text-xs"><span>Documents</span><span>{bytes(data.limits.maxDocumentBytes)}</span></div>
          <div className="flex justify-between text-xs"><span>Submission screenshots</span><span>{data.limits.maxSubmissionScreenshots}</span></div>
        </Card>
      </div>
    </PageContainer>
  );
}

export function AdminPlatformSettingsPage() {
  return <PlatformAccessGuard anyOf={["platform.manage_feature_flags"]}><AdminPlatformSettingsContent /></PlatformAccessGuard>;
}
