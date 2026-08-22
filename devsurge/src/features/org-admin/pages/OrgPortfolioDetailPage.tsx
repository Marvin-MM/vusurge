import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Target, CheckCircle2, Activity, FileText, History, Plus, Trash2, Pencil, ChevronDown, ChevronUp, Link2, StickyNote, ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmActionDialog } from "@/components/feedback/ConfirmActionDialog";
import { PageContainer } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useAssetUrl } from "@/lib/assetUrl";
import { useUploadImage } from "@/lib/imageUpload";
import {
  useInnovationPortfolioItem,
  useInnovationMilestones,
  useInnovationMetrics,
  useInnovationEvidence,
  useInnovationStageHistory,
  useTransitionInnovationStage,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useCreateMetric,
  useUpdateMetric,
  useMetricMeasurements,
  useRecordMeasurement,
  useCreateEvidence,
  useDeleteEvidence,
} from "@/features/org-admin/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import type { InnovationMetric } from "@/types";
import { toast } from "sonner";

const STAGES = ["DISCOVERY", "VALIDATION", "PROTOTYPE", "PILOT", "INCUBATION", "SCALE"];
const MILESTONE_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "AT_RISK", "CANCELLED"];
const METRIC_TYPES = ["NUMBER", "PERCENTAGE", "CURRENCY"];
const EVIDENCE_TYPES = [
  { value: "LINK", label: "Link", icon: Link2 },
  { value: "MEDIA_ASSET", label: "Image", icon: ImageIcon },
  { value: "NOTE", label: "Note", icon: StickyNote },
] as const;

export function OrgPortfolioDetailPage() {
  const { orgId = "", itemId = "" } = useParams<{ orgId: string; itemId: string }>();
  const navigate = useNavigate();
  const { userContext } = useAuth();
  // All list/get endpoints for this sub-resource tree only require
  // `innovation.view` (held by CHALLENGE_MANAGER+); only writes require
  // `innovation.manage` (ORG_ADMIN+) — see innovation-portfolio.service.ts's
  // authorize() calls. The page guard below matches the read permission so a
  // CHALLENGE_MANAGER can view this page at all; every write affordance is
  // separately gated on `canManage`.
  const canManage = can(userContext, "innovation.manage");
  const canView = can(userContext, "innovation.view");
  const { data: item, isLoading } = useInnovationPortfolioItem(orgId, itemId, { enabled: canView });
  const { data: milestones = [] } = useInnovationMilestones(orgId, itemId, { enabled: canView });
  const { data: metrics = [] } = useInnovationMetrics(orgId, itemId, { enabled: canView });
  const { data: evidence = [] } = useInnovationEvidence(orgId, itemId, { enabled: canView });
  const { data: stageHistory = [] } = useInnovationStageHistory(orgId, itemId, { enabled: canView });
  const transitionMutation = useTransitionInnovationStage(orgId, itemId);

  const [nextStage, setNextStage] = React.useState("");
  const [milestoneDialogOpen, setMilestoneDialogOpen] = React.useState(false);
  const [metricDialogOpen, setMetricDialogOpen] = React.useState(false);
  const [editMetric, setEditMetric] = React.useState<InnovationMetric | null>(null);
  const [evidenceDialogOpen, setEvidenceDialogOpen] = React.useState(false);
  const [deleteMilestoneId, setDeleteMilestoneId] = React.useState<string | null>(null);
  const [deleteEvidenceId, setDeleteEvidenceId] = React.useState<string | null>(null);

  const createMilestoneMutation = useCreateMilestone(orgId, itemId);
  const updateMilestoneMutation = useUpdateMilestone(orgId, itemId);
  const deleteMilestoneMutation = useDeleteMilestone(orgId, itemId);
  const createMetricMutation = useCreateMetric(orgId, itemId);
  const updateMetricMutation = useUpdateMetric(orgId, itemId);
  const createEvidenceMutation = useCreateEvidence(orgId, itemId);
  const deleteEvidenceMutation = useDeleteEvidence(orgId, itemId);

  if (isLoading || !item) {
    return (
      <PageContainer>
        <div className="py-20 text-center text-xs text-muted-foreground">Loading...</div>
      </PageContainer>
    );
  }

  return (
    <OrgAccessGuard permission="innovation.view" title="Portfolio Restricted" description="You require organization membership with innovation-tracking access to view this portfolio item.">
      <PageContainer className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/portfolio`)} className="text-xs h-8 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Portfolio</span>
        </Button>

        <Card className="p-6 border-border space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{item.stage}</Badge>
          </div>
          <h1 className="text-2xl font-black text-foreground">{item.title}</h1>
          {item.opportunityStatement && <p className="text-sm text-muted-foreground">{item.opportunityStatement}</p>}
          {item.thesis && (
            <div className="pt-3 border-t border-border/60 space-y-1">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-primary" />
                Thesis
              </div>
              <p className="text-xs text-muted-foreground">{item.thesis}</p>
            </div>
          )}

          {canManage && (
            <div className="flex items-center gap-2 pt-3 border-t border-border/60">
              <Select value={nextStage} onValueChange={setNextStage}>
                <SelectTrigger className="h-9 text-xs w-56"><SelectValue placeholder="Transition to stage..." /></SelectTrigger>
                <SelectContent>
                  {STAGES.filter((s) => s !== item.stage).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!nextStage || transitionMutation.isPending}
                onClick={() =>
                  transitionMutation.mutate(
                    { toStage: nextStage },
                    { onSuccess: () => { toast.success("Stage updated."); setNextStage(""); }, onError: (err: any) => toast.error(err?.message || "Failed to transition.") }
                  )
                }
                className="text-xs font-semibold gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Transition
              </Button>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Milestones
              </CardTitle>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setMilestoneDialogOpen(true)} className="h-7 text-[11px] gap-1">
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {milestones.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No milestones yet.</div>
              ) : (
                milestones.map((m) => (
                  <div key={m.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-foreground truncate">{m.title}</div>
                      {m.dueDate && <div className="text-muted-foreground">Due {new Date(m.dueDate).toLocaleDateString()}</div>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {canManage ? (
                        <>
                          <Select
                            value={m.status}
                            onValueChange={(status) => updateMilestoneMutation.mutate({ milestoneId: m.id, payload: { status } }, { onError: (err: any) => toast.error(err?.message || "Failed to update status.") })}
                          >
                            <SelectTrigger className="h-7 text-[10px] w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {MILESTONE_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-[10px]">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteMilestoneId(m.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{m.status}</Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Metrics
              </CardTitle>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setMetricDialogOpen(true)} className="h-7 text-[11px] gap-1">
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {metrics.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No metrics tracked yet.</div>
              ) : (
                metrics.map((m) => (
                  <MetricRow key={m.id} organizationId={orgId} innovationId={itemId} metric={m} onEdit={() => setEditMetric(m)} canManage={canManage} />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Evidence
              </CardTitle>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => setEvidenceDialogOpen(true)} className="h-7 text-[11px] gap-1">
                  <Plus className="h-3 w-3" />
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {evidence.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No evidence attached yet.</div>
              ) : (
                evidence.map((e) => (
                  <div key={e.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {e.type === "MEDIA_ASSET" && e.mediaAssetId ? (
                        <EvidenceThumb assetId={e.mediaAssetId} />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-muted/40 border border-border flex items-center justify-center shrink-0">
                          {e.type === "LINK" ? <Link2 className="h-3.5 w-3.5 text-muted-foreground" /> : <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-foreground truncate">{e.title}</div>
                        {e.type === "LINK" && e.url && (
                          <a href={e.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">View link</a>
                        )}
                        {e.type === "NOTE" && e.note && <div className="text-muted-foreground truncate max-w-xs">{e.note}</div>}
                      </div>
                    </div>
                    {canManage && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setDeleteEvidenceId(e.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-4 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Stage History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {stageHistory.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No stage changes yet.</div>
              ) : (
                stageHistory.map((h) => (
                  <div key={h.id} className="p-4 flex items-center justify-between text-xs">
                    <span className="text-foreground">{h.previousStage || "—"} → <strong>{h.newStage}</strong></span>
                    <span className="text-muted-foreground">{new Date(h.createdAt).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </PageContainer>

      <MilestoneDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        onSubmit={(payload) =>
          createMilestoneMutation.mutate(payload, {
            onSuccess: () => { toast.success("Milestone added."); setMilestoneDialogOpen(false); },
            onError: (err: any) => toast.error(err?.message || "Failed to add milestone."),
          })
        }
        loading={createMilestoneMutation.isPending}
      />

      <MetricDialog
        open={metricDialogOpen}
        onOpenChange={setMetricDialogOpen}
        onSubmit={(payload) =>
          createMetricMutation.mutate(payload, {
            onSuccess: () => { toast.success("Metric added."); setMetricDialogOpen(false); },
            onError: (err: any) => toast.error(err?.message || "Failed to add metric."),
          })
        }
        loading={createMetricMutation.isPending}
      />

      <EditMetricDialog
        metric={editMetric}
        onOpenChange={(open) => !open && setEditMetric(null)}
        onSubmit={(payload) => {
          if (!editMetric) return;
          updateMetricMutation.mutate(
            { metricId: editMetric.id, payload },
            {
              onSuccess: () => { toast.success("Metric updated."); setEditMetric(null); },
              onError: (err: any) => toast.error(err?.message || "Failed to update metric."),
            }
          );
        }}
        loading={updateMetricMutation.isPending}
      />

      <EvidenceDialog
        open={evidenceDialogOpen}
        onOpenChange={setEvidenceDialogOpen}
        organizationId={orgId}
        innovationId={itemId}
        onSubmit={(payload) =>
          createEvidenceMutation.mutate(payload, {
            onSuccess: () => { toast.success("Evidence added."); setEvidenceDialogOpen(false); },
            onError: (err: any) => toast.error(err?.message || "Failed to add evidence."),
          })
        }
        loading={createEvidenceMutation.isPending}
      />

      <ConfirmActionDialog
        open={Boolean(deleteMilestoneId)}
        onOpenChange={(open) => !open && setDeleteMilestoneId(null)}
        title="Delete Milestone"
        description="This milestone will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        loading={deleteMilestoneMutation.isPending}
        onConfirm={() => {
          if (!deleteMilestoneId) return;
          deleteMilestoneMutation.mutate(deleteMilestoneId, {
            onSuccess: () => { toast.success("Milestone deleted."); setDeleteMilestoneId(null); },
            onError: (err: any) => toast.error(err?.message || "Failed to delete milestone."),
          });
        }}
      />

      <ConfirmActionDialog
        open={Boolean(deleteEvidenceId)}
        onOpenChange={(open) => !open && setDeleteEvidenceId(null)}
        title="Delete Evidence"
        description="This evidence item will be permanently removed. This cannot be undone."
        confirmLabel="Delete"
        loading={deleteEvidenceMutation.isPending}
        onConfirm={() => {
          if (!deleteEvidenceId) return;
          deleteEvidenceMutation.mutate(deleteEvidenceId, {
            onSuccess: () => { toast.success("Evidence deleted."); setDeleteEvidenceId(null); },
            onError: (err: any) => toast.error(err?.message || "Failed to delete evidence."),
          });
        }}
      />
    </OrgAccessGuard>
  );
}

function EvidenceThumb({ assetId }: { assetId: string }) {
  const { url } = useAssetUrl(assetId, "authenticated");
  return (
    <div className="h-9 w-9 rounded-lg bg-muted/40 border border-border overflow-hidden shrink-0">
      {url ? <img src={url} alt="Evidence" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /></div>}
    </div>
  );
}

function MetricRow({ organizationId, innovationId, metric, onEdit, canManage }: { organizationId: string; innovationId: string; metric: InnovationMetric; onEdit: () => void; canManage: boolean }) {
  const [expanded, setExpanded] = React.useState(false);
  const [recordOpen, setRecordOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [note, setNote] = React.useState("");
  const { items: measurements, isLoading } = useMetricMeasurements(organizationId, innovationId, expanded ? metric.id : "");
  const recordMutation = useRecordMeasurement(organizationId, innovationId);

  const handleRecord = () => {
    if (!value.trim()) {
      toast.error("Enter a value.");
      return;
    }
    recordMutation.mutate(
      { metricId: metric.id, payload: { value: value.trim(), measuredAt: new Date().toISOString(), note: note.trim() || undefined } },
      {
        onSuccess: () => {
          toast.success("Measurement recorded.");
          setValue("");
          setNote("");
          setRecordOpen(false);
          setExpanded(true);
        },
        onError: (err: any) => toast.error(err?.message || "Failed to record measurement."),
      }
    );
  };

  return (
    <div className="text-xs">
      <div className="p-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex items-center gap-1.5 min-w-0 text-left hover:text-primary transition-colors">
          {expanded ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
          <span className="font-bold text-foreground truncate">{metric.name}</span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-muted-foreground">{metric.targetValue != null ? `Target: ${metric.targetValue}${metric.unit ? ` ${metric.unit}` : ""}` : metric.metricType}</span>
          {canManage && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => setRecordOpen(true)}>
                Record
              </Button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pl-9 space-y-1">
          {isLoading ? (
            <div className="text-muted-foreground">Loading measurements...</div>
          ) : measurements.length === 0 ? (
            <div className="text-muted-foreground">No measurements recorded yet.</div>
          ) : (
            measurements.map((mm) => (
              <div key={mm.id} className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{new Date(mm.measuredAt).toLocaleDateString()}{mm.note ? ` — ${mm.note}` : ""}</span>
                <span className="font-semibold text-foreground">{mm.value}{metric.unit ? ` ${metric.unit}` : ""}</span>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">Record Measurement — {metric.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Value *</label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={metric.metricType === "PERCENTAGE" ? "e.g. 42" : "e.g. 1500"} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Note</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="text-xs" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setRecordOpen(false)} className="text-xs">Cancel</Button>
            <Button size="sm" onClick={handleRecord} disabled={recordMutation.isPending} className="text-xs">
              {recordMutation.isPending ? "Recording..." : "Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MilestoneDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { title: string; description?: string; status?: string; dueDate?: string }) => void;
  loading: boolean;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [status, setStatus] = React.useState("PLANNED");
  const [dueDate, setDueDate] = React.useState("");

  React.useEffect(() => {
    if (open) { setTitle(""); setDescription(""); setStatus("PLANNED"); setDueDate(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-sm">Add Milestone</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xs h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MILESTONE_STATUSES.map((s) => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Due Date</label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="text-xs h-9" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">Cancel</Button>
          <Button
            size="sm"
            disabled={!title.trim() || loading}
            onClick={() => onSubmit({ title: title.trim(), description: description.trim() || undefined, status, dueDate: dueDate || undefined })}
            className="text-xs"
          >
            {loading ? "Adding..." : "Add Milestone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricDialog({
  open,
  onOpenChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { name: string; metricType: string; unit?: string; targetValue?: string }) => void;
  loading: boolean;
}) {
  const [name, setName] = React.useState("");
  const [metricType, setMetricType] = React.useState("NUMBER");
  const [unit, setUnit] = React.useState("");
  const [targetValue, setTargetValue] = React.useState("");

  React.useEffect(() => {
    if (open) { setName(""); setMetricType("NUMBER"); setUnit(""); setTargetValue(""); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-sm">Add Metric</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly Active Users" className="text-xs h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Type *</label>
              <Select value={metricType} onValueChange={setMetricType}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{METRIC_TYPES.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Unit</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. users" className="text-xs h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Target Value</label>
            <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="e.g. 10000" className="text-xs h-9" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">Cancel</Button>
          <Button
            size="sm"
            disabled={!name.trim() || loading}
            onClick={() => onSubmit({ name: name.trim(), metricType, unit: unit.trim() || undefined, targetValue: targetValue.trim() || undefined })}
            className="text-xs"
          >
            {loading ? "Adding..." : "Add Metric"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditMetricDialog({
  metric,
  onOpenChange,
  onSubmit,
  loading,
}: {
  metric: InnovationMetric | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { name?: string; unit?: string; targetValue?: string | null }) => void;
  loading: boolean;
}) {
  const [name, setName] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [targetValue, setTargetValue] = React.useState("");

  React.useEffect(() => {
    if (metric) { setName(metric.name); setUnit(metric.unit || ""); setTargetValue(metric.targetValue || ""); }
  }, [metric]);

  return (
    <Dialog open={Boolean(metric)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-sm">Edit Metric</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Name *</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xs h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Unit</label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Target Value</label>
              <Input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="text-xs h-9" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">Cancel</Button>
          <Button
            size="sm"
            disabled={!name.trim() || loading}
            onClick={() => onSubmit({ name: name.trim(), unit: unit.trim() || undefined, targetValue: targetValue.trim() || null })}
            className="text-xs"
          >
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvidenceDialog({
  open,
  onOpenChange,
  organizationId,
  innovationId,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  innovationId: string;
  onSubmit: (payload: { type: "LINK" | "MEDIA_ASSET" | "NOTE"; title: string; url?: string; mediaAssetId?: string; note?: string }) => void;
  loading: boolean;
}) {
  const [type, setType] = React.useState<"LINK" | "MEDIA_ASSET" | "NOTE">("LINK");
  const [title, setTitle] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [note, setNote] = React.useState("");
  const [uploadedAssetId, setUploadedAssetId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadImage();

  React.useEffect(() => {
    if (open) { setType("LINK"); setTitle(""); setUrl(""); setNote(""); setUploadedAssetId(null); }
  }, [open]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const assetId = await uploadMutation.mutateAsync({ purpose: "PORTFOLIO_EVIDENCE", organizationId, resourceId: innovationId, file });
      setUploadedAssetId(assetId);
      toast.success("Image uploaded.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload image.");
    }
  };

  const canSubmit =
    title.trim().length > 0 &&
    (type === "LINK" ? url.trim().length > 0 : type === "MEDIA_ASSET" ? Boolean(uploadedAssetId) : note.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="text-sm">Add Evidence</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Type</label>
            <div className="flex gap-1.5">
              {EVIDENCE_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setType(value)}
                  className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border text-xs font-medium transition-colors ${type === value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xs h-9" />
          </div>
          {type === "LINK" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">URL *</label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="text-xs h-9 font-mono" />
            </div>
          )}
          {type === "NOTE" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Note *</label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="text-xs" />
            </div>
          )}
          {type === "MEDIA_ASSET" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Image *</label>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
              {uploadedAssetId ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/20 text-xs">
                  <EvidenceThumb assetId={uploadedAssetId} />
                  <span className="text-foreground">Image uploaded</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-7 ml-auto">Replace</Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending} className="text-xs h-8 gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadMutation.isPending ? "Uploading..." : "Upload Image"}
                </Button>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">Cancel</Button>
          <Button
            size="sm"
            disabled={!canSubmit || loading}
            onClick={() =>
              onSubmit({
                type,
                title: title.trim(),
                url: type === "LINK" ? url.trim() : undefined,
                mediaAssetId: type === "MEDIA_ASSET" ? uploadedAssetId || undefined : undefined,
                note: type === "NOTE" ? note.trim() : undefined,
              })
            }
            className="text-xs"
          >
            {loading ? "Adding..." : "Add Evidence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
