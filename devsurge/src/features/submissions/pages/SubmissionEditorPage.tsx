import * as React from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { ArrowLeft, Sparkles, Code, Link2, Video, ShieldCheck, CheckCircle2, Save, Lock, FileText, Image as ImageIcon, Upload, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import {
  useMySubmission,
  useSubmission,
  useCreateSubmission,
  useUpdateSubmissionDraft,
  useFinalizeSubmission,
} from "@/features/submissions/api/queries";
import { useAssetUrl } from "@/lib/assetUrl";
import { useUploadImage } from "@/lib/imageUpload";
import { useUploadPrivateFile, useRequestPrivateFileDownload, readStoredFileRef, writeStoredFileRef } from "@/lib/fileUpload";
import { TechnologyTagPicker } from "@/components/shared/TechnologyTagPicker";
import { toast } from "sonner";

const MAX_SCREENSHOTS = 4;

function ScreenshotThumb({ assetId, onRemove }: { assetId: string; onRemove: () => void }) {
  const { url } = useAssetUrl(assetId, "authenticated");
  return (
    <div className="relative h-20 w-32 rounded-lg border border-border bg-muted/40 overflow-hidden shrink-0 group">
      {url ? <img src={url} alt="Screenshot" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function SubmissionEditorPage() {
  const navigate = useNavigate();
  const { submissionId } = useParams<{ submissionId?: string }>();
  const [searchParams] = useSearchParams();
  const organizationId = searchParams.get("organizationId") || "";
  const challengeId = searchParams.get("challengeId") || "";
  const teamId = searchParams.get("teamId") || undefined;

  const isEditMode = Boolean(submissionId);
  const { data: existingById } = useSubmission(organizationId, challengeId, submissionId || "");
  const { data: mySubmission } = useMySubmission(organizationId, challengeId);
  const submission = isEditMode ? existingById : mySubmission;

  const createMutation = useCreateSubmission(organizationId, challengeId);
  const updateDraftMutation = useUpdateSubmissionDraft(organizationId, challengeId);
  const finalizeMutation = useFinalizeSubmission(organizationId, challengeId);

  const [title, setTitle] = React.useState("");
  const [tagline, setTagline] = React.useState("");
  const [problemStatement, setProblemStatement] = React.useState("");
  const [solutionDescription, setSolutionDescription] = React.useState("");
  const [impactBeneficiaries, setImpactBeneficiaries] = React.useState("");
  const [technologyTags, setTechnologyTags] = React.useState<string[]>([]);
  const [repositoryUrl, setRepositoryUrl] = React.useState("");
  const [demoUrl, setDemoUrl] = React.useState("");
  const [pitchVideoUrl, setPitchVideoUrl] = React.useState("");
  const [presentationUrl, setPresentationUrl] = React.useState("");
  const [screenshotAssetIds, setScreenshotAssetIds] = React.useState<string[]>([]);
  const [supportingLinks, setSupportingLinks] = React.useState<{ label: string; url: string }[]>([]);
  const [publicationConsent, setPublicationConsent] = React.useState(true);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  const uploadImageMutation = useUploadImage();
  const uploadPresentationMutation = useUploadPrivateFile();
  const requestDownloadMutation = useRequestPrivateFileDownload();
  const screenshotInputRef = React.useRef<HTMLInputElement>(null);
  const presentationInputRef = React.useRef<HTMLInputElement>(null);
  const [presentationFileRef, setPresentationFileRef] = React.useState<{ fileId: string; displayName: string } | null>(null);

  React.useEffect(() => {
    if (submission?.id) setPresentationFileRef(readStoredFileRef(`submission:${submission.id}:presentation`));
  }, [submission?.id]);

  React.useEffect(() => {
    if (submission?.draftVersion && !hydrated) {
      const v = submission.draftVersion;
      setTitle(v.title || "");
      setTagline(v.tagline || "");
      setProblemStatement(v.problemStatement || "");
      setSolutionDescription(v.solutionDescription || "");
      setImpactBeneficiaries(v.impactBeneficiaries || "");
      setTechnologyTags(v.technologyTags || []);
      setRepositoryUrl(v.repositoryUrl || "");
      setDemoUrl(v.demoUrl || "");
      setPitchVideoUrl(v.pitchVideoUrl || "");
      setPresentationUrl((v as any).presentationUrl || "");
      setSupportingLinks((v as any).supportingLinks || []);
      setPublicationConsent(v.publicationConsent ?? true);
      setHydrated(true);
    }
  }, [submission, hydrated]);

  React.useEffect(() => {
    if (submission?.screenshots) setScreenshotAssetIds(submission.screenshots);
  }, [submission?.screenshots]);

  const buildDraftPayload = () => ({
    title,
    tagline,
    problemStatement,
    solutionDescription,
    impactBeneficiaries,
    technologyTags,
    // The backend validates these as absolute https URLs when present and
    // requires them to be omitted (not an empty string) otherwise — sending
    // "" fails format validation with a 422.
    repositoryUrl: repositoryUrl.trim() || undefined,
    demoUrl: demoUrl.trim() || undefined,
    pitchVideoUrl: pitchVideoUrl.trim() || undefined,
    presentationUrl: presentationUrl.trim() || undefined,
    supportingLinks: supportingLinks.filter((l) => l.label.trim() && l.url.trim()),
    screenshotAssetIds,
    publicationConsent,
  });

  const ensureSubmissionExists = async (): Promise<string> => {
    if (submission) return submission.id;
    const created = await createMutation.mutateAsync({ teamId });
    return created.id;
  };

  // SUBMISSION_PRESENTATION's `resourceId` is the submission's current draft
  // *version* id (`submission_version.id`), not the submission's own id —
  // the backend resolves ownership/edit-eligibility off the version row.
  // Reuses `ensureSubmissionExists`'s own creation rather than calling
  // `createMutation` a second time (which would create a duplicate submission).
  const ensureSubmissionAndDraftVersion = async (): Promise<{ submissionId: string; draftVersionId: string }> => {
    if (submission?.draftVersion) return { submissionId: submission.id, draftVersionId: submission.draftVersion.id };
    const created = await createMutation.mutateAsync({ teamId });
    if (!created.draftVersion) throw new Error("Submission was created without a draft version.");
    return { submissionId: created.id, draftVersionId: created.draftVersion.id };
  };

  const handleScreenshotSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (screenshotAssetIds.length >= MAX_SCREENSHOTS) {
      toast.error(`You can attach up to ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }
    try {
      const id = await ensureSubmissionExists();
      const assetId = await uploadImageMutation.mutateAsync({ purpose: "SUBMISSION_SCREENSHOT", organizationId, challengeId, resourceId: id, file });
      setScreenshotAssetIds((prev) => [...prev, assetId]);
      toast.success("Screenshot added.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload screenshot.");
    }
  };

  const handleRemoveScreenshot = (assetId: string) => {
    setScreenshotAssetIds((prev) => prev.filter((id) => id !== assetId));
  };

  const handlePresentationFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const { submissionId, draftVersionId } = await ensureSubmissionAndDraftVersion();
      const asset = await uploadPresentationMutation.mutateAsync({ purpose: "SUBMISSION_PRESENTATION", organizationId, challengeId, resourceId: draftVersionId, file });
      const ref = { fileId: asset.id, displayName: file.name };
      writeStoredFileRef(`submission:${submissionId}:presentation`, ref);
      setPresentationFileRef(ref);
      toast.success("Presentation file uploaded — it will be scanned before it's downloadable.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload presentation file.");
    }
  };

  const handleDownloadPresentation = () => {
    if (!presentationFileRef) return;
    requestDownloadMutation.mutate(presentationFileRef.fileId, {
      onSuccess: (res) => window.open(res.downloadUrl, "_blank"),
      onError: (err: any) => {
        if (err?.code === "FILE_SCAN_PENDING") toast.error("Still being scanned — try again in a moment.");
        else toast.error(err?.message || "Failed to get download link.");
      },
    });
  };

  const handleAddSupportingLink = () => setSupportingLinks((prev) => [...prev, { label: "", url: "" }]);
  const handleUpdateSupportingLink = (index: number, field: "label" | "url", value: string) =>
    setSupportingLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  const handleRemoveSupportingLink = (index: number) => setSupportingLinks((prev) => prev.filter((_, i) => i !== index));

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      toast.error("Please enter a project title.");
      return;
    }
    try {
      const id = await ensureSubmissionExists();
      await updateDraftMutation.mutateAsync({ submissionId: id, payload: buildDraftPayload() });
      toast.success("Draft saved.");
      navigate("/app/submissions");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save draft.");
    }
  };

  const handleConfirmFinalize = async () => {
    try {
      const id = await ensureSubmissionExists();
      await updateDraftMutation.mutateAsync({ submissionId: id, payload: buildDraftPayload() });
      await finalizeMutation.mutateAsync(id);
      setFinalizeDialogOpen(false);
      toast.success("Submission finalized and locked for judging.");
      navigate(`/app/submissions/${id}?organizationId=${organizationId}&challengeId=${challengeId}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to finalize submission.");
    }
  };

  const isSaving = createMutation.isPending || updateDraftMutation.isPending;

  return (
    <PageContainer className="space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/app/submissions")} className="text-xs h-8 gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Submissions</span>
        </Button>

        <PageHeader
          title={isEditMode ? "Edit Submission Draft" : "New Submission"}
          description="Provide public links and a description of your project. Finalizing locks it for judging."
        />

        <div className="space-y-6">
          <Card className="border-border p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Project Identity</h3>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Project Title *</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. AuraMesh Coordination Protocol" className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tagline</label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Short one-line summary" className="text-xs h-9" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Problem Statement</label>
              <Textarea value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} rows={3} className="text-xs leading-relaxed" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Solution Description</label>
              <Textarea value={solutionDescription} onChange={(e) => setSolutionDescription(e.target.value)} rows={5} className="text-xs leading-relaxed" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Impact & Beneficiaries</label>
              <Textarea value={impactBeneficiaries} onChange={(e) => setImpactBeneficiaries(e.target.value)} rows={2} className="text-xs leading-relaxed" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Technologies</label>
              <TechnologyTagPicker selectedTags={technologyTags} onChange={setTechnologyTags} />
            </div>
          </Card>

          <Card className="border-border p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <Code className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Links</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Code className="h-3.5 w-3.5 text-primary" />
                  <span>Repository URL</span>
                </label>
                <Input value={repositoryUrl} onChange={(e) => setRepositoryUrl(e.target.value)} placeholder="https://github.com/your-org/project" className="text-xs h-9 font-mono" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Live Demo URL</span>
                </label>
                <Input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://demo.yourproject.com" className="text-xs h-9 font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Video className="h-3.5 w-3.5 text-purple-500" />
                <span>Pitch Video URL</span>
              </label>
              <Input value={pitchVideoUrl} onChange={(e) => setPitchVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="text-xs h-9 font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-amber-500" />
                <span>Presentation URL</span>
              </label>
              <Input value={presentationUrl} onChange={(e) => setPresentationUrl(e.target.value)} placeholder="https://slides.com/your-deck" className="text-xs h-9 font-mono" />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border/60">
              <label className="text-xs font-semibold text-foreground">Supporting Links</label>
              {supportingLinks.map((link, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={link.label} onChange={(e) => handleUpdateSupportingLink(i, "label", e.target.value)} placeholder="Label" className="text-xs h-9 w-1/3" />
                  <Input value={link.url} onChange={(e) => handleUpdateSupportingLink(i, "url", e.target.value)} placeholder="https://..." className="text-xs h-9 flex-1 font-mono" />
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveSupportingLink(i)} className="h-9 w-9 text-destructive shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={handleAddSupportingLink} className="text-xs h-8 gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                Add Link
              </Button>
            </div>
          </Card>

          <Card className="border-border p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <ImageIcon className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Screenshots</h3>
              <span className="text-[11px] text-muted-foreground ml-auto">{screenshotAssetIds.length}/{MAX_SCREENSHOTS}</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {screenshotAssetIds.map((assetId) => (
                <ScreenshotThumb key={assetId} assetId={assetId} onRemove={() => handleRemoveScreenshot(assetId)} />
              ))}
              {screenshotAssetIds.length < MAX_SCREENSHOTS && (
                <button
                  type="button"
                  onClick={() => screenshotInputRef.current?.click()}
                  disabled={uploadImageMutation.isPending}
                  className="h-20 w-32 rounded-lg border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors shrink-0"
                >
                  <Upload className="h-4 w-4" />
                  <span className="text-[10px]">{uploadImageMutation.isPending ? "Uploading..." : "Add"}</span>
                </button>
              )}
            </div>
            <input ref={screenshotInputRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshotSelected} />

            <div className="pt-3 border-t border-border/60 space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Presentation Deck (PDF or document)</label>
              <input ref={presentationInputRef} type="file" accept=".pdf,.ppt,.pptx,.key,.doc,.docx" className="hidden" onChange={handlePresentationFileSelected} />
              {presentationFileRef ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-muted/20 text-xs">
                  <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-foreground truncate flex-1">{presentationFileRef.displayName}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={handleDownloadPresentation} disabled={requestDownloadMutation.isPending} className="text-xs h-7 shrink-0">
                    Download
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => presentationInputRef.current?.click()} className="text-xs h-7 shrink-0">
                    Replace
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => presentationInputRef.current?.click()} disabled={uploadPresentationMutation.isPending} className="text-xs h-8 gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  {uploadPresentationMutation.isPending ? "Uploading..." : "Upload Presentation File"}
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">Newly uploaded files are scanned before they can be downloaded again.</p>
            </div>
          </Card>

          <Card className="border-border p-6 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-border/60">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-foreground">Publication Consent</h3>
            </div>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer hover:border-primary/40">
              <input type="checkbox" checked={publicationConsent} onChange={(e) => setPublicationConsent(e.target.checked)} className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4" />
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-foreground">I consent to publishing this project publicly</div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  If the organizer enables the public project gallery, your submission may be showcased publicly.
                </p>
              </div>
            </label>
          </Card>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={isSaving} className="text-xs h-9 font-semibold gap-1.5 w-full sm:w-auto">
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? "Saving..." : "Save Draft"}</span>
            </Button>
            <Button type="button" onClick={() => setFinalizeDialogOpen(true)} className="text-xs h-9 font-bold gap-1.5 w-full sm:w-auto">
              <Lock className="h-3.5 w-3.5" />
              <span>Finalize Submission</span>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              <span>Confirm Final Submission</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">Please review before finalizing.</DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
            <p className="font-bold text-amber-600 dark:text-amber-400">Important:</p>
            <p className="text-muted-foreground leading-relaxed">
              Once finalized, this submission is locked for judging and cannot be edited without organizer intervention.
            </p>
          </div>

          <DialogFooter className="flex gap-2 justify-end">
            <Button type="button" variant="outline" size="sm" onClick={() => setFinalizeDialogOpen(false)} className="text-xs">Back to Editing</Button>
            <Button type="button" size="sm" onClick={handleConfirmFinalize} disabled={finalizeMutation.isPending} className="text-xs font-bold gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{finalizeMutation.isPending ? "Locking..." : "Yes, Finalize"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
