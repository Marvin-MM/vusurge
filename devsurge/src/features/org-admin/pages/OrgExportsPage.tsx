import * as React from "react";
import { useParams } from "react-router-dom";
import { Download, Plus, Trash2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { LoadMoreButton } from "@/components/shared/LoadMoreButton";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useExportJobs, useCreateExportJob, useDeleteExportJob, useDownloadExportJob, ExportJob } from "@/features/org-admin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { toast } from "sonner";

const EXPORT_TYPE_LABEL: Record<ExportJob["exportType"], string> = {
  ORGANIZATION_MEMBERS: "Organization Members",
  ORGANIZATION_SUBMISSIONS: "All Submissions",
  ORGANIZATION_PARTICIPATION: "All Participation Records",
  CHALLENGE_RESULTS: "Challenge Results",
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  PROCESSING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  PENDING: "bg-muted text-muted-foreground border-border",
  FAILED: "bg-destructive/10 text-destructive border-destructive/20",
};

export function OrgExportsPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const { userContext } = useAuth();
  const { items: jobs, isLoading, hasMore, loadMore, isLoadingMore } = useExportJobs(orgId, {
    enabled: can(userContext, "organization.manage_settings"),
  });
  const createMutation = useCreateExportJob(orgId);
  const deleteMutation = useDeleteExportJob(orgId);
  const downloadMutation = useDownloadExportJob(orgId);

  const [exportType, setExportType] = React.useState<ExportJob["exportType"]>("ORGANIZATION_MEMBERS");

  const handleDownload = (job: ExportJob) => {
    downloadMutation.mutate(job.id, {
      onSuccess: (res) => window.open(res.downloadUrl, "_blank"),
      onError: (err: any) => toast.error(err?.message || "Failed to get download link."),
    });
  };

  return (
    <OrgAccessGuard permission="organization.manage_settings" title="Data Exports Restricted" description="You require Organization Admin privileges to generate data exports.">
      <PageContainer className="space-y-6">
        <PageHeader
          title="Data Exports"
          description="Generate and download exports of your organization's data."
          actions={
            <div className="flex items-center gap-2">
              <Select value={exportType} onValueChange={(v: any) => setExportType(v)}>
                <SelectTrigger className="h-8 text-xs w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPORT_TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={createMutation.isPending}
                onClick={() => createMutation.mutate({ exportType }, { onSuccess: () => toast.success("Export requested.") })}
                className="text-xs font-semibold gap-1.5 h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Export</span>
              </Button>
            </div>
          }
        />

        <Card className="border-border">
          <CardHeader className="p-4 border-b border-border/60">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Export Jobs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border/60">
            {isLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading...</div>
            ) : jobs.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground text-xs">No exports generated yet.</div>
            ) : (
              jobs.map((job) => (
                <div key={job.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{EXPORT_TYPE_LABEL[job.exportType]}</span>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[job.status] || ""}`}>{job.status}</Badge>
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(job.createdAt).toLocaleString()}
                      {job.rowCount != null && ` • ${job.rowCount} rows`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {job.status === "COMPLETED" && (
                      <Button variant="outline" size="sm" onClick={() => handleDownload(job)} className="text-xs h-8 gap-1.5">
                        <FileDown className="h-3.5 w-3.5" />
                        <span>Download</span>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(job.id)} className="h-8 w-8 text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <LoadMoreButton hasMore={hasMore} isLoadingMore={isLoadingMore} onClick={loadMore} />
      </PageContainer>
    </OrgAccessGuard>
  );
}
