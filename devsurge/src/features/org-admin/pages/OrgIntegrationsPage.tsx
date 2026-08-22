import * as React from "react";
import { useParams } from "react-router-dom";
import { Slack, MessageSquare, Trash2, PlugZap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useOrgIntegrations, useCreateSlackIntegration, useCreateDiscordIntegration, useDeleteIntegration, useTestIntegration } from "@/features/org-admin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { toast } from "sonner";

export function OrgIntegrationsPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { userContext } = useAuth();
  const { data: integrations = [], isLoading } = useOrgIntegrations(orgId, {
    enabled: can(userContext, "organization.manage_integrations"),
  });
  const createSlackMutation = useCreateSlackIntegration(orgId);
  const createDiscordMutation = useCreateDiscordIntegration(orgId);
  const deleteMutation = useDeleteIntegration(orgId);
  const testMutation = useTestIntegration(orgId);

  const [slackUrl, setSlackUrl] = React.useState("");
  const [discordUrl, setDiscordUrl] = React.useState("");

  return (
    <OrgAccessGuard permission="organization.manage_integrations" title="Integrations Restricted" description="You require Organization Admin privileges to manage integrations.">
      <PageContainer className="space-y-6">
        <PageHeader title="Integrations" description="Connect Slack or Discord to receive notifications." />

        <Card className="border-border">
          <CardHeader className="p-4 border-b border-border/60">
            <CardTitle className="text-sm font-bold">Connected Integrations</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
            ) : integrations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No integrations connected yet.</div>
            ) : (
              integrations.map((i) => (
                <div key={i.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    {i.provider === "slack" ? <Slack className="h-4 w-4 text-primary" /> : <MessageSquare className="h-4 w-4 text-primary" />}
                    <div>
                      <div className="font-bold text-foreground capitalize">{i.provider}</div>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{i.status}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => testMutation.mutate(i.id, { onSuccess: () => toast.success("Test message sent.") })} className="text-xs h-8 gap-1.5">
                      <PlugZap className="h-3.5 w-3.5" />
                      <span>Test</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(i.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-border p-5 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <Slack className="h-4 w-4 text-primary" />
              Slack Webhook
            </div>
            <Input value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} placeholder="https://hooks.slack.com/..." className="text-xs h-9 font-mono" />
            <Button
              size="sm"
              disabled={!slackUrl.trim() || createSlackMutation.isPending}
              onClick={() => createSlackMutation.mutate(slackUrl, { onSuccess: () => { setSlackUrl(""); toast.success("Slack connected."); }, onError: (err: any) => toast.error(err?.message || "Failed to connect.") })}
              className="text-xs font-semibold gap-1.5 w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              Connect Slack
            </Button>
          </Card>
          <Card className="border-border p-5 space-y-3">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <MessageSquare className="h-4 w-4 text-primary" />
              Discord Webhook
            </div>
            <Input value={discordUrl} onChange={(e) => setDiscordUrl(e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="text-xs h-9 font-mono" />
            <Button
              size="sm"
              disabled={!discordUrl.trim() || createDiscordMutation.isPending}
              onClick={() => createDiscordMutation.mutate(discordUrl, { onSuccess: () => { setDiscordUrl(""); toast.success("Discord connected."); }, onError: (err: any) => toast.error(err?.message || "Failed to connect.") })}
              className="text-xs font-semibold gap-1.5 w-full"
            >
              <Plus className="h-3.5 w-3.5" />
              Connect Discord
            </Button>
          </Card>
        </div>
      </PageContainer>
    </OrgAccessGuard>
  );
}
