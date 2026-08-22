import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Calendar,
  Award,
  Layers,
  Plus,
  Trash2,
  FileText,
  Shield,
  Users,
  Building,
  Scale,
  Sparkles,
  Save,
  Send,
  Tag,
  AlertCircle,
  UserPlus,
  Pencil,
  Upload,
  ImageIcon,
} from "lucide-react";
import { useAssetUrl } from "@/lib/assetUrl";
import { useUploadImage } from "@/lib/imageUpload";
import { Sponsor } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import { useOrgChallenge } from "@/features/challenges/api/queries";
import {
  useCreateChallenge,
  useUpdateChallenge,
  usePublishChallenge,
  useRescheduleChallenge,
  useAdminTracks,
  useCreateTrack,
  useUpdateTrack,
  useDeleteTrack,
  useAdminPrizes,
  useCreatePrize,
  useUpdatePrize,
  useDeletePrize,
  useAdminSponsors,
  useCreateSponsor,
  useUpdateSponsor,
  useDeleteSponsor,
  useAdminStaff,
  useInviteStaff,
  useCreateTermsVersion,
  useCurrentTerms,
  useTermsVersions,
  useActivateTermsVersion,
} from "@/features/org-admin/api/queries";
import { toast } from "sonner";

export function OrgChallengeEditorPage() {
  const { orgId = "", challengeId } = useParams<{ orgId: string; challengeId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(challengeId && challengeId !== "new");
  const { data: existingChallenge } = useOrgChallenge(orgId, isEditing ? challengeId! : "");

  const createMutation = useCreateChallenge(orgId);
  const updateMutation = useUpdateChallenge(orgId, challengeId || "");
  const publishMutation = usePublishChallenge(orgId);
  const rescheduleMutation = useRescheduleChallenge(orgId);
  const uploadImageMutation = useUploadImage();
  const { url: coverUrl } = useAssetUrl(existingChallenge?.coverAssetId, "authenticated");
  const coverInputRef = React.useRef<HTMLInputElement>(null);

  const handleCoverSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isEditing || !challengeId) return;
    uploadImageMutation.mutate(
      { purpose: "CHALLENGE_COVER", organizationId: orgId, challengeId, file },
      {
        onSuccess: (assetId) =>
          updateMutation.mutate(
            { coverAssetId: assetId },
            { onSuccess: () => toast.success("Cover image updated."), onError: (err: any) => toast.error(err?.message || "Failed to save cover image.") },
          ),
        onError: (err: any) => toast.error(err?.message || "Failed to upload cover image."),
      },
    );
  };

  const [activeSection, setActiveSection] = React.useState(1);

  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [visibility, setVisibility] = React.useState<"PUBLIC" | "ORG_MEMBERS" | "UNLISTED">("PUBLIC");
  const [minTeamSize, setMinTeamSize] = React.useState(1);
  const [maxTeamSize, setMaxTeamSize] = React.useState(4);
  const [soloParticipationAllowed, setSoloParticipationAllowed] = React.useState(true);
  const [screeningRequired, setScreeningRequired] = React.useState(false);
  const [participationPolicy, setParticipationPolicy] = React.useState("OPEN_AUTHENTICATED");
  const [submissionRequirements, setSubmissionRequirements] = React.useState("");
  const [blindJudgingEnabled, setBlindJudgingEnabled] = React.useState(true);
  const [publicProjectPublicationEnabled, setPublicProjectPublicationEnabled] = React.useState(false);

  const [registrationOpenAt, setRegistrationOpenAt] = React.useState("");
  const [registrationCloseAt, setRegistrationCloseAt] = React.useState("");
  const [submissionOpenAt, setSubmissionOpenAt] = React.useState("");
  const [submissionDeadline, setSubmissionDeadline] = React.useState("");
  const [judgingStartAt, setJudgingStartAt] = React.useState("");
  const [judgingEndAt, setJudgingEndAt] = React.useState("");

  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (existingChallenge && !hydrated) {
      setTitle(existingChallenge.title);
      setSlug(existingChallenge.slug);
      setSummary(existingChallenge.summary || "");
      setDescription(existingChallenge.description || "");
      setVisibility((existingChallenge.visibility as any) || "PUBLIC");
      setMinTeamSize(existingChallenge.minTeamSize);
      setMaxTeamSize(existingChallenge.maxTeamSize);
      setSoloParticipationAllowed(existingChallenge.soloParticipationAllowed);
      setScreeningRequired(existingChallenge.screeningRequired || false);
      setParticipationPolicy(existingChallenge.participationPolicy);
      setSubmissionRequirements(existingChallenge.submissionRequirements || "");
      setBlindJudgingEnabled(existingChallenge.blindJudgingEnabled || false);
      setPublicProjectPublicationEnabled(existingChallenge.publicProjectPublicationEnabled || false);
      setRegistrationOpenAt(existingChallenge.registrationOpenAt?.split("T")[0] || "");
      setRegistrationCloseAt(existingChallenge.registrationCloseAt?.split("T")[0] || "");
      setSubmissionOpenAt(existingChallenge.submissionOpenAt?.split("T")[0] || "");
      setSubmissionDeadline(existingChallenge.submissionDeadline?.split("T")[0] || "");
      setJudgingStartAt(existingChallenge.judgingStartAt?.split("T")[0] || "");
      setJudgingEndAt(existingChallenge.judgingEndAt?.split("T")[0] || "");
      setHydrated(true);
    }
  }, [existingChallenge, hydrated]);

  const handleNameChange = (val: string) => {
    setTitle(val);
    if (!isEditing) setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const buildCorePayload = () => ({
    title,
    slug,
    summary,
    description,
    visibility,
    minTeamSize,
    maxTeamSize,
    soloParticipationAllowed,
    screeningRequired,
    participationPolicy,
    submissionRequirements,
    blindJudgingEnabled,
    publicProjectPublicationEnabled,
  });

  const handleSaveCore = () => {
    if (!title.trim() || !slug.trim()) {
      toast.error("Title and slug are required.");
      return;
    }
    if (isEditing) {
      updateMutation.mutate(buildCorePayload(), {
        onSuccess: () => toast.success("Challenge updated."),
        onError: (err: any) => toast.error(err?.message || "Failed to update challenge."),
      });
    } else {
      createMutation.mutate(buildCorePayload() as any, {
        onSuccess: (created) => {
          toast.success("Challenge created as a draft.");
          navigate(`/org/${orgId}/challenges/${created.id}/edit`);
        },
        onError: (err: any) => toast.error(err?.message || "Failed to create challenge."),
      });
    }
  };

  const handleSaveSchedule = () => {
    if (!challengeId || !isEditing) {
      toast.error("Save the challenge's core details first.");
      return;
    }
    rescheduleMutation.mutate(
      {
        challengeId,
        payload: {
          registrationOpenAt: registrationOpenAt ? new Date(registrationOpenAt).toISOString() : undefined,
          registrationCloseAt: registrationCloseAt ? new Date(registrationCloseAt).toISOString() : undefined,
          submissionOpenAt: submissionOpenAt ? new Date(submissionOpenAt).toISOString() : undefined,
          submissionDeadline: submissionDeadline ? new Date(submissionDeadline).toISOString() : undefined,
          judgingStartAt: judgingStartAt ? new Date(judgingStartAt).toISOString() : undefined,
          judgingEndAt: judgingEndAt ? new Date(judgingEndAt).toISOString() : undefined,
          reason: "Schedule set via challenge editor.",
        },
      },
      {
        onSuccess: () => toast.success("Schedule saved."),
        onError: (err: any) => toast.error(err?.message || "Failed to save schedule."),
      }
    );
  };

  const handlePublish = () => {
    if (!challengeId) return;
    publishMutation.mutate(
      { challengeId },
      {
        onSuccess: () => toast.success("Challenge published."),
        onError: (err: any) => toast.error(err?.message || "Failed to publish. Make sure a submission deadline is set."),
      }
    );
  };

  const sectionsList = [
    { num: 1, title: "Core Details", icon: Sparkles },
    { num: 2, title: "Schedule", icon: Calendar },
    { num: 3, title: "Rules & Participation", icon: Users },
    ...(isEditing
      ? [
          { num: 4, title: "Tracks", icon: Tag },
          { num: 5, title: "Prizes", icon: Award },
          { num: 6, title: "Sponsors", icon: Building },
          { num: 7, title: "Judges & Mentors", icon: UserPlus },
          { num: 8, title: "Terms", icon: Scale },
          { num: 9, title: "Publish", icon: CheckCircle2 },
        ]
      : []),
  ];

  return (
    <OrgAccessGuard permission="challenge.edit" title="Challenge Builder Restricted" description="You require Challenge Manager or Organization Admin privileges to construct or modify challenge specifications.">
      <PageContainer className="space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/org/${orgId}/challenges`)} className="text-xs h-8 gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Challenges</span>
          </Button>
        </div>

        <PageHeader title={isEditing ? `Edit: ${existingChallenge?.title || title}` : "Create New Challenge"} description="Configure your challenge's details, schedule, and structure." />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-3 space-y-1 bg-card border border-border rounded-xl p-2 shadow-2xs">
            {sectionsList.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.num;
              return (
                <button
                  key={sec.num}
                  type="button"
                  onClick={() => setActiveSection(sec.num)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                    isActive ? "bg-primary text-primary-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-9 space-y-6">
            {activeSection === 1 && (
              <Card className="p-6 space-y-4 border-border">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Core Details
                </h3>
                {isEditing && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Cover Image</label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-32 rounded-lg border border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                        {coverUrl ? <img src={coverUrl} alt="Challenge cover" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelected} />
                      <Button type="button" variant="outline" size="sm" disabled={uploadImageMutation.isPending} onClick={() => coverInputRef.current?.click()} className="text-xs gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadImageMutation.isPending ? "Uploading..." : "Upload Cover"}
                      </Button>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Title *</label>
                  <Input value={title} onChange={(e) => handleNameChange(e.target.value)} className="text-xs h-9" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">URL Slug *</label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="text-xs h-9 font-mono" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Summary</label>
                  <Input value={summary} onChange={(e) => setSummary(e.target.value)} className="text-xs h-9" placeholder="Short one-line summary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Description</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="text-xs min-h-[140px]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Visibility</label>
                  <Select value={visibility} onValueChange={(v: any) => setVisibility(v)}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PUBLIC">Public</SelectItem>
                      <SelectItem value="ORG_MEMBERS">Organization Members Only</SelectItem>
                      <SelectItem value="UNLISTED">Unlisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveCore} disabled={createMutation.isPending || updateMutation.isPending} className="text-xs font-semibold gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    <span>{isEditing ? "Save Changes" : "Create Challenge"}</span>
                  </Button>
                </div>
              </Card>
            )}

            {activeSection === 2 && (
              <Card className="p-6 space-y-4 border-border">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  Schedule
                </h3>
                {!isEditing && (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Create the challenge first, then set its schedule.</span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Registration Opens</label>
                    <Input type="date" value={registrationOpenAt} onChange={(e) => setRegistrationOpenAt(e.target.value)} className="text-xs h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Registration Closes</label>
                    <Input type="date" value={registrationCloseAt} onChange={(e) => setRegistrationCloseAt(e.target.value)} className="text-xs h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Submissions Open</label>
                    <Input type="date" value={submissionOpenAt} onChange={(e) => setSubmissionOpenAt(e.target.value)} className="text-xs h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Submission Deadline *</label>
                    <Input type="date" value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} className="text-xs h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Judging Starts</label>
                    <Input type="date" value={judgingStartAt} onChange={(e) => setJudgingStartAt(e.target.value)} className="text-xs h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Judging Ends</label>
                    <Input type="date" value={judgingEndAt} onChange={(e) => setJudgingEndAt(e.target.value)} className="text-xs h-9" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveSchedule} disabled={!isEditing || rescheduleMutation.isPending} className="text-xs font-semibold gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Schedule</span>
                  </Button>
                </div>
              </Card>
            )}

            {activeSection === 3 && (
              <Card className="p-6 space-y-4 border-border">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                  <Users className="h-4 w-4 text-primary" />
                  Rules & Participation
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Min Team Size</label>
                    <Input type="number" value={minTeamSize} onChange={(e) => setMinTeamSize(Number(e.target.value))} min={1} className="text-xs h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Max Team Size</label>
                    <Input type="number" value={maxTeamSize} onChange={(e) => setMaxTeamSize(Number(e.target.value))} min={1} className="text-xs h-9" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Participation Policy</label>
                  <Select value={participationPolicy} onValueChange={setParticipationPolicy}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN_AUTHENTICATED">Any authenticated user</SelectItem>
                      <SelectItem value="ORG_MEMBERS_ONLY">Organization members only</SelectItem>
                      <SelectItem value="APPROVED_CHALLENGE_PARTICIPANTS">Screening application required</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Submission Requirements</label>
                  <Textarea value={submissionRequirements} onChange={(e) => setSubmissionRequirements(e.target.value)} className="text-xs min-h-[90px]" placeholder="Describe what a finalized submission must include..." />
                </div>
                {[
                  { label: "Solo participation allowed", checked: soloParticipationAllowed, onChange: setSoloParticipationAllowed },
                  { label: "Require screening application before approval", checked: screeningRequired, onChange: setScreeningRequired },
                  { label: "Blind judging (hide team identity from judges)", checked: blindJudgingEnabled, onChange: setBlindJudgingEnabled },
                  { label: "Allow public project gallery publication", checked: publicProjectPublicationEnabled, onChange: setPublicProjectPublicationEnabled },
                ].map((opt) => (
                  <label key={opt.label} className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/20 cursor-pointer">
                    <input type="checkbox" checked={opt.checked} onChange={(e) => opt.onChange(e.target.checked)} className="rounded border-border" />
                    <span className="text-xs text-foreground font-medium">{opt.label}</span>
                  </label>
                ))}
                <div className="flex justify-end pt-2">
                  <Button onClick={handleSaveCore} disabled={createMutation.isPending || updateMutation.isPending} className="text-xs font-semibold gap-1.5">
                    <Save className="h-3.5 w-3.5" />
                    <span>Save Rules</span>
                  </Button>
                </div>
              </Card>
            )}

            {isEditing && activeSection === 4 && <TracksSection organizationId={orgId} challengeId={challengeId!} />}
            {isEditing && activeSection === 5 && <PrizesSection organizationId={orgId} challengeId={challengeId!} />}
            {isEditing && activeSection === 6 && <SponsorsSection organizationId={orgId} challengeId={challengeId!} />}
            {isEditing && activeSection === 7 && <StaffSection organizationId={orgId} challengeId={challengeId!} />}
            {isEditing && activeSection === 8 && <TermsSection organizationId={orgId} challengeId={challengeId!} />}

            {isEditing && activeSection === 9 && (
              <Card className="p-6 space-y-6 border-border">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Publish
                </h3>
                <div className="p-3 rounded-xl border border-border bg-muted/20 flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">Current Status</span>
                  <Badge variant="outline" className="font-mono">{existingChallenge?.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  A submission deadline must be set (see Schedule) before this challenge can be published.
                </p>
                <Button onClick={handlePublish} disabled={publishMutation.isPending || existingChallenge?.status !== "DRAFT"} className="text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Send className="h-3.5 w-3.5" />
                  <span>{existingChallenge?.status === "DRAFT" ? "Publish Challenge" : `Already ${existingChallenge?.status}`}</span>
                </Button>
              </Card>
            )}
          </div>
        </div>
      </PageContainer>
    </OrgAccessGuard>
  );
}

function TracksSection({ organizationId, challengeId }: { organizationId: string; challengeId: string }) {
  const { data: tracks = [] } = useAdminTracks(organizationId, challengeId);
  const createMutation = useCreateTrack(organizationId, challengeId);
  const updateMutation = useUpdateTrack(organizationId, challengeId);
  const deleteMutation = useDeleteTrack(organizationId, challengeId);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");

  return (
    <Card className="p-6 space-y-4 border-border">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
        <Tag className="h-4 w-4 text-primary" />
        Tracks
      </h3>
      <div className="space-y-2">
        {tracks.map((t) =>
          editingId === t.id ? (
            <div key={t.id} className="p-3 rounded-lg border border-primary/40 bg-muted/20 flex gap-2 text-xs">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-xs h-9" />
              <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="text-xs h-9" placeholder="Description" />
              <Button
                size="sm"
                disabled={!editName.trim() || updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate(
                    { trackId: t.id, payload: { name: editName, description: editDescription || undefined } },
                    { onSuccess: () => { setEditingId(null); toast.success("Track updated."); }, onError: (err: any) => toast.error(err?.message || "Failed to update.") },
                  )
                }
                className="text-xs h-9 shrink-0"
              >
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="text-xs h-9 shrink-0">Cancel</Button>
            </div>
          ) : (
            <div key={t.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-foreground">{t.name}</div>
                {t.description && <div className="text-muted-foreground">{t.description}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => { setEditingId(t.id); setEditName(t.name); setEditDescription(t.description || ""); }} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Track name" className="text-xs h-9" />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="text-xs h-9" />
        <Button
          size="sm"
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate({ name, description: description || undefined }, { onSuccess: () => { setName(""); setDescription(""); } })}
          className="text-xs h-9 gap-1 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </Card>
  );
}

function PrizesSection({ organizationId, challengeId }: { organizationId: string; challengeId: string }) {
  const { data: prizes = [] } = useAdminPrizes(organizationId, challengeId);
  const createMutation = useCreatePrize(organizationId, challengeId);
  const updateMutation = useUpdatePrize(organizationId, challengeId);
  const deleteMutation = useDeletePrize(organizationId, challengeId);
  const [title, setTitle] = React.useState("");
  const [valueLabel, setValueLabel] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editValueLabel, setEditValueLabel] = React.useState("");

  return (
    <Card className="p-6 space-y-4 border-border">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
        <Award className="h-4 w-4 text-emerald-500" />
        Prizes
      </h3>
      <div className="space-y-2">
        {prizes.map((p) =>
          editingId === p.id ? (
            <div key={p.id} className="p-3 rounded-lg border border-primary/40 bg-muted/20 flex gap-2 text-xs">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-xs h-9" />
              <Input value={editValueLabel} onChange={(e) => setEditValueLabel(e.target.value)} className="text-xs h-9" placeholder="Value label" />
              <Button
                size="sm"
                disabled={!editTitle.trim() || updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate(
                    { prizeId: p.id, payload: { title: editTitle, valueLabel: editValueLabel || undefined } },
                    { onSuccess: () => { setEditingId(null); toast.success("Prize updated."); }, onError: (err: any) => toast.error(err?.message || "Failed to update.") },
                  )
                }
                className="text-xs h-9 shrink-0"
              >
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="text-xs h-9 shrink-0">Cancel</Button>
            </div>
          ) : (
            <div key={p.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3 text-xs">
              <div>
                <div className="font-bold text-foreground">{p.title}</div>
                {p.valueLabel && <div className="text-muted-foreground font-mono">{p.valueLabel}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => { setEditingId(p.id); setEditTitle(p.title); setEditValueLabel(p.valueLabel || ""); }} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(p.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 1st Place" className="text-xs h-9" />
        <Input value={valueLabel} onChange={(e) => setValueLabel(e.target.value)} placeholder="e.g. $5,000 + mentorship" className="text-xs h-9" />
        <Button
          size="sm"
          disabled={!title.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate({ title, valueLabel: valueLabel || undefined }, { onSuccess: () => { setTitle(""); setValueLabel(""); } })}
          className="text-xs h-9 gap-1 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </Card>
  );
}

function SponsorLogo({ organizationId, challengeId, sponsor }: { organizationId: string; challengeId: string; sponsor: Sponsor }) {
  const { url: logoUrl } = useAssetUrl(sponsor.logoAssetId, "authenticated");
  const uploadImageMutation = useUploadImage();
  const updateMutation = useUpdateSponsor(organizationId, challengeId);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadImageMutation.mutate(
      { purpose: "SPONSOR_LOGO", organizationId, challengeId, resourceId: sponsor.id, file },
      {
        onSuccess: (assetId) =>
          updateMutation.mutate(
            { sponsorId: sponsor.id, payload: { logoAssetId: assetId } },
            { onSuccess: () => toast.success("Logo updated."), onError: (err: any) => toast.error(err?.message || "Failed to save logo.") },
          ),
        onError: (err: any) => toast.error(err?.message || "Failed to upload logo."),
      },
    );
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploadImageMutation.isPending}
      className="h-10 w-10 rounded-md border border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0 hover:border-primary/50"
      title="Upload sponsor logo"
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleSelected} />
      {logoUrl ? <img src={logoUrl} alt={sponsor.name} className="h-full w-full object-cover" /> : <Upload className="h-3.5 w-3.5 text-muted-foreground" />}
    </button>
  );
}

function SponsorsSection({ organizationId, challengeId }: { organizationId: string; challengeId: string }) {
  const { data: sponsors = [] } = useAdminSponsors(organizationId, challengeId);
  const createMutation = useCreateSponsor(organizationId, challengeId);
  const updateMutation = useUpdateSponsor(organizationId, challengeId);
  const deleteMutation = useDeleteSponsor(organizationId, challengeId);
  const [name, setName] = React.useState("");
  const [tier, setTier] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editTier, setEditTier] = React.useState("");

  return (
    <Card className="p-6 space-y-4 border-border">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
        <Building className="h-4 w-4 text-primary" />
        Sponsors
      </h3>
      <div className="space-y-2">
        {sponsors.map((s) =>
          editingId === s.id ? (
            <div key={s.id} className="p-3 rounded-lg border border-primary/40 bg-muted/20 flex gap-2 text-xs">
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="text-xs h-9" />
              <Input value={editTier} onChange={(e) => setEditTier(e.target.value)} className="text-xs h-9" placeholder="Tier" />
              <Button
                size="sm"
                disabled={!editName.trim() || updateMutation.isPending}
                onClick={() =>
                  updateMutation.mutate(
                    { sponsorId: s.id, payload: { name: editName, tier: editTier || null } },
                    { onSuccess: () => { setEditingId(null); toast.success("Sponsor updated."); }, onError: (err: any) => toast.error(err?.message || "Failed to update.") },
                  )
                }
                className="text-xs h-9 shrink-0"
              >
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} className="text-xs h-9 shrink-0">Cancel</Button>
            </div>
          ) : (
            <div key={s.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <SponsorLogo organizationId={organizationId} challengeId={challengeId} sponsor={s} />
                <div>
                  <div className="font-bold text-foreground">{s.name}</div>
                  {s.tier && <div className="text-muted-foreground">{s.tier}</div>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => { setEditingId(s.id); setEditName(s.name); setEditTier(s.tier || ""); }} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(s.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sponsor name" className="text-xs h-9" />
        <Input value={tier} onChange={(e) => setTier(e.target.value)} placeholder="Tier (e.g. Gold)" className="text-xs h-9" />
        <Button
          size="sm"
          disabled={!name.trim() || createMutation.isPending}
          onClick={() => createMutation.mutate({ name, tier: tier || undefined }, { onSuccess: () => { setName(""); setTier(""); } })}
          className="text-xs h-9 gap-1 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </Card>
  );
}

function StaffSection({ organizationId, challengeId }: { organizationId: string; challengeId: string }) {
  const { data: staff = [] } = useAdminStaff(organizationId, challengeId);
  const inviteMutation = useInviteStaff(organizationId, challengeId);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"JUDGE" | "MENTOR">("JUDGE");

  return (
    <Card className="p-6 space-y-4 border-border">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
        <UserPlus className="h-4 w-4 text-primary" />
        Judges & Mentors
      </h3>
      <div className="space-y-2">
        {staff.length === 0 ? (
          <p className="text-xs text-muted-foreground">No staff assigned yet.</p>
        ) : (
          staff.map((s) => (
            <div key={s.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3 text-xs">
              <span className="font-mono text-foreground">{s.userId}</span>
              <Badge variant="outline" className="text-[10px]">{s.role}</Badge>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 pt-2">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" type="email" className="text-xs h-9 flex-1" />
        <Select value={role} onValueChange={(v: any) => setRole(v)}>
          <SelectTrigger className="h-9 text-xs w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="JUDGE">Judge</SelectItem>
            <SelectItem value="MENTOR">Mentor</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          disabled={!email.trim() || inviteMutation.isPending}
          onClick={() =>
            inviteMutation.mutate(
              { email, role },
              { onSuccess: () => { setEmail(""); toast.success("Invitation sent."); }, onError: (err: any) => toast.error(err?.message || "Failed to invite.") }
            )
          }
          className="text-xs h-9 gap-1 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Invite
        </Button>
      </div>
    </Card>
  );
}

function TermsSection({ organizationId, challengeId }: { organizationId: string; challengeId: string }) {
  const { data: currentTerms } = useCurrentTerms(organizationId, challengeId);
  const { data: versions = [] } = useTermsVersions(organizationId, challengeId);
  const createMutation = useCreateTermsVersion(organizationId, challengeId);
  const activateMutation = useActivateTermsVersion(organizationId, challengeId);
  const [content, setContent] = React.useState("");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (currentTerms && !hydrated) {
      setContent(currentTerms.content);
      setHydrated(true);
    }
  }, [currentTerms, hydrated]);

  return (
    <Card className="p-6 space-y-4 border-border">
      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border/60 pb-3">
        <Scale className="h-4 w-4 text-amber-500" />
        Terms of Participation
      </h3>
      {currentTerms ? (
        <div className="text-[11px] text-muted-foreground">Current active version: v{currentTerms.version}</div>
      ) : (
        <div className="text-[11px] text-amber-600">No terms version is currently active — participants won't be asked to accept anything yet.</div>
      )}
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="text-xs min-h-[160px] font-mono leading-relaxed" placeholder="Terms of participation text..." />
      <p className="text-[11px] text-muted-foreground">
        Creating a version does not make it active on its own — activate it below once you're ready for participants to see and accept it.
      </p>
      <div className="flex justify-end">
        <Button
          onClick={() =>
            createMutation.mutate(content, {
              onSuccess: () => toast.success("New terms version created — activate it below to make it live."),
              onError: (err: any) => toast.error(err?.message || "Failed to create terms version."),
            })
          }
          disabled={!content.trim() || createMutation.isPending}
          className="text-xs font-semibold gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          <span>Create New Version</span>
        </Button>
      </div>

      {versions.length > 0 && (
        <div className="pt-3 border-t border-border/60 space-y-2">
          <div className="text-xs font-bold text-foreground">Version History</div>
          {versions
            .slice()
            .sort((a, b) => b.version - a.version)
            .map((v) => (
              <div key={v.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-foreground">v{v.version}</span>
                  <span className="text-muted-foreground"> · {new Date(v.createdAt).toLocaleDateString()}</span>
                </div>
                {v.isActive ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={activateMutation.isPending}
                    onClick={() =>
                      activateMutation.mutate(v.id, {
                        onSuccess: () => toast.success(`Version ${v.version} activated.`),
                        onError: (err: any) => toast.error(err?.message || "Failed to activate."),
                      })
                    }
                    className="text-xs h-7"
                  >
                    Activate
                  </Button>
                )}
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}
