import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock, Inbox, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { DynamicFormBuilder } from "@/components/forms/DynamicFormBuilder";
import {
  useFormDefinition,
  useFormVersions,
  useCreateFormVersion,
  usePublishFormVersion,
  useFormResponses,
} from "@/features/forms/api/queries";
import { FormResponseEntry, FormSchema } from "@/types";
import { toast } from "sonner";

function ResponseRow({ response }: { response: FormResponseEntry }) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div>
      <div onClick={() => setExpanded((v) => !v)} className="p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/20">
        <div className="flex items-center gap-2 text-xs">
          {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="font-bold text-foreground">
            {response.displayName || response.email || response.userId.slice(0, 8)}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">{new Date(response.submittedAt).toLocaleString()}</span>
      </div>
      {expanded && (
        <div className="px-4 pb-3 bg-muted/20">
          <pre className="p-2.5 rounded-lg bg-background border border-border text-[11px] font-mono overflow-x-auto">
            {JSON.stringify(response.responseData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export function OrgFormDetailPage() {
  const { orgId = "", formId = "" } = useParams<{ orgId: string; formId: string }>();
  const navigate = useNavigate();
  const { data: form } = useFormDefinition(orgId, formId);
  const { data: versions = [] } = useFormVersions(orgId, formId);
  const createVersionMutation = useCreateFormVersion(orgId, formId);
  const publishMutation = usePublishFormVersion(orgId, formId);
  const { items: responses, isLoading: loadingResponses, hasMore, loadMore, isLoadingMore } = useFormResponses(orgId, formId);

  const [showBuilder, setShowBuilder] = React.useState(false);
  const latestVersion = versions[versions.length - 1];
  const publishedVersion = versions.find((v) => v.isPublished);

  if (!form) {
    return (
      <PageContainer>
        <div className="py-20 text-center text-xs text-muted-foreground">Loading...</div>
      </PageContainer>
    );
  }

  return (
    <OrgAccessGuard permission="organization.manage_forms" title="Forms Restricted" description="You require Challenge Manager privileges or higher to manage custom forms.">
      <PageContainer className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/forms`)} className="text-xs h-8 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Forms</span>
        </Button>

        <PageHeader title={form.name} description={`Purpose: ${form.purpose.replace(/_/g, " ")}`} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold">Version History</CardTitle>
              {!showBuilder && (
                <Button size="sm" variant="outline" onClick={() => setShowBuilder(true)} className="h-7 text-[11px]">
                  New Version
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {versions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No versions yet — create the first one.</div>
              ) : (
                [...versions].reverse().map((v) => (
                  <div key={v.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-foreground">Version {v.version}</div>
                      <div className="text-[11px] text-muted-foreground">{v.schema.fields.length} field{v.schema.fields.length === 1 ? "" : "s"} · {new Date(v.createdAt).toLocaleDateString()}</div>
                    </div>
                    {v.isPublished ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Published
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        disabled={publishMutation.isPending}
                        onClick={() =>
                          publishMutation.mutate(v.id, {
                            onSuccess: () => toast.success(`Version ${v.version} published.`),
                            onError: (err: any) => toast.error(err?.message || "Failed to publish."),
                          })
                        }
                      >
                        Publish
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Inbox className="h-4 w-4 text-primary" />
                Responses {publishedVersion ? `(${responses.length}${hasMore ? "+" : ""})` : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {!publishedVersion ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  <Clock className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
                  No published version yet — responses can only be submitted once one is live.
                </div>
              ) : loadingResponses ? (
                <div className="p-6 text-center text-xs text-muted-foreground">Loading...</div>
              ) : responses.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No responses yet.</div>
              ) : (
                responses.map((r) => <ResponseRow key={r.id} response={r} />)
              )}
            </CardContent>
            {publishedVersion && <div className="p-3"><LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} /></div>}
          </Card>
        </div>

        {showBuilder && (
          <Card className="border-border p-5">
            <DynamicFormBuilder
              initialSchema={latestVersion?.schema ?? { fields: [] }}
              saving={createVersionMutation.isPending}
              onSave={(schema: FormSchema) =>
                createVersionMutation.mutate(schema, {
                  onSuccess: () => {
                    toast.success("New version created as a draft — publish it to make it live.");
                    setShowBuilder(false);
                  },
                  onError: (err: any) => toast.error(err?.message || "Failed to save version."),
                })
              }
            />
          </Card>
        )}
      </PageContainer>
    </OrgAccessGuard>
  );
}
