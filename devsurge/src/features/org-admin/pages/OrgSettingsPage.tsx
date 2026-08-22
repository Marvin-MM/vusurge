import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Building, Shield, Crown, CheckCircle2, AlertCircle, Lock, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { OrgAccessGuard } from "@/features/org-admin/components/OrgAccessGuard";
import {
  useOrgAdminMembers,
  useTransferOwnership,
  useArchiveOrganization,
  useOrganizationSettings,
  useUpdateOrganizationSettings,
  useUpdateOrganizationProfile,
} from "@/features/org-admin/api/queries";
import { useOrganization } from "@/features/organizations/api/queries";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/types/permissions";
import { useAssetUrl } from "@/lib/assetUrl";
import { useUploadImage } from "@/lib/imageUpload";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export function OrgSettingsPage() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { user, userContext } = useAuth();
  const canManageSettings = can(userContext, "organization.manage_settings");
  const { data: org } = useOrganization(orgId);
  const { data: settings } = useOrganizationSettings(orgId);
  // Gated on the same permission as this page's own OrgAccessGuard: without
  // it, the guard hides all rendered content anyway, so these calls would
  // only ever produce a 403/404 that a lower-permission user visiting this
  // route directly (nav already hides the link, but a direct URL still
  // reaches the component) would see as a console error for no benefit.
  const { data: members = [] } = useOrgAdminMembers(orgId, undefined, { enabled: canManageSettings });
  const transferOwnershipMutation = useTransferOwnership(orgId);
  const archiveOrgMutation = useArchiveOrganization(orgId);
  const updateSettingsMutation = useUpdateOrganizationSettings(orgId);
  const updateProfileMutation = useUpdateOrganizationProfile(orgId);
  const uploadImageMutation = useUploadImage();
  const { url: logoUrl } = useAssetUrl(org?.logoAssetId, "authenticated", { enabled: canManageSettings });
  const logoInputRef = React.useRef<HTMLInputElement>(null);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [publicMetricsEnabled, setPublicMetricsEnabled] = React.useState(false);
  const [publicProjectGalleryEnabled, setPublicProjectGalleryEnabled] = React.useState(false);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (org && settings && !hydrated) {
      setName(org.name);
      setDescription(org.description || "");
      setWebsiteUrl(org.websiteUrl || "");
      setPublicMetricsEnabled(settings.publicMetricsEnabled);
      setPublicProjectGalleryEnabled(settings.publicProjectGalleryEnabled);
      setHydrated(true);
    }
  }, [org, settings, hydrated]);

  const [transferModalOpen, setTransferModalOpen] = React.useState(false);
  const [targetOwnerId, setTargetOwnerId] = React.useState("");
  const [transferReason, setTransferReason] = React.useState("");
  const [confirmPhrase, setConfirmPhrase] = React.useState("");
  const [archiveModalOpen, setArchiveModalOpen] = React.useState(false);
  const [archiveReason, setArchiveReason] = React.useState("");
  const [archiveConfirmPhrase, setArchiveConfirmPhrase] = React.useState("");

  const isOwner = userContext.orgRole === "ORG_OWNER";
  const canTransferOwnership = can(userContext, "organization.transfer_ownership");
  const canArchiveOrganization = can(userContext, "organization.archive");
  const eligibleNewOwners = members.filter((m) => m.userId !== user?.id && m.role !== "ORG_OWNER" && m.status === "ACTIVE");

  const handleLogoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadImageMutation.mutate(
      { purpose: "ORGANIZATION_LOGO", organizationId: orgId, file },
      {
        onSuccess: (assetId) =>
          updateProfileMutation.mutate(
            { logoAssetId: assetId },
            { onSuccess: () => toast.success("Logo updated."), onError: (err: any) => toast.error(err?.message || "Failed to save logo.") },
          ),
        onError: (err: any) => toast.error(err?.message || "Failed to upload logo."),
      },
    );
  };

  const handleSaveGeneral = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate(
      { name, description, websiteUrl },
      {
        onSuccess: () => toast.success("Organization profile updated."),
        onError: (err: any) => toast.error(err?.message || "Failed to update profile."),
      }
    );
  };

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(
      { publicMetricsEnabled, publicProjectGalleryEnabled },
      {
        onSuccess: () => toast.success("Organization settings updated."),
        onError: (err: any) => toast.error(err?.message || "Failed to update settings."),
      }
    );
  };

  const handleTransferOwnership = () => {
    if (confirmPhrase !== "TRANSFER OWNERSHIP") {
      toast.error('You must type "TRANSFER OWNERSHIP" exactly to confirm.');
      return;
    }
    if (!targetOwnerId || !transferReason.trim()) {
      toast.error("Please select a member and provide a reason.");
      return;
    }
    transferOwnershipMutation.mutate(
      { newOwnerUserId: targetOwnerId, reason: transferReason },
      {
        onSuccess: () => {
          toast.success("Organization ownership transferred. Your role is now ORG_ADMIN.");
          setTransferModalOpen(false);
          setConfirmPhrase("");
        },
        onError: (err: any) => toast.error(err?.message || "Failed to transfer ownership."),
      }
    );
  };

  const handleArchiveOrganization = () => {
    if (archiveConfirmPhrase !== "ARCHIVE ORGANIZATION") {
      toast.error('You must type "ARCHIVE ORGANIZATION" exactly to confirm.');
      return;
    }
    if (archiveReason.trim().length < 10) {
      toast.error("Please provide a reason of at least 10 characters.");
      return;
    }
    archiveOrgMutation.mutate(archiveReason, {
      onSuccess: () => {
        toast.success("Organization archived.");
        setArchiveModalOpen(false);
        navigate("/app");
      },
      onError: (err: any) => toast.error(err?.message || "Failed to archive organization."),
    });
  };

  return (
    <OrgAccessGuard
      permission="organization.manage_settings"
      title="Settings Restricted"
      description="You require Organization Admin or Organization Owner privileges to modify organization settings."
    >
      <PageContainer className="space-y-6">
        <PageHeader title="Organization Settings" description="Manage workspace profile, visibility, and ownership." />

        <div className="max-w-3xl space-y-6">
          <Card className="border-border">
            <CardHeader className="p-5 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building className="h-4 w-4 text-primary" />
                Workspace Profile
              </CardTitle>
              <CardDescription className="text-xs">Publicly facing branding and directory appearance.</CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <div className="flex items-center gap-4 pb-4 mb-4 border-b border-border/60">
                <div className="h-16 w-16 rounded-xl border border-border bg-muted/40 overflow-hidden flex items-center justify-center shrink-0">
                  {logoUrl ? <img src={logoUrl} alt="Organization logo" className="h-full w-full object-cover" /> : <Building className="h-6 w-6 text-muted-foreground" />}
                </div>
                <div className="space-y-1.5">
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelected} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadImageMutation.isPending}
                    onClick={() => logoInputRef.current?.click()}
                    className="text-xs gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploadImageMutation.isPending ? "Uploading..." : "Upload Logo"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">PNG, JPG, or WebP.</p>
                </div>
              </div>
              <form onSubmit={handleSaveGeneral} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Organization Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="text-xs h-9" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Description</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="text-xs min-h-[70px]" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Website URL</label>
                  <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="text-xs h-9 font-mono" />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" size="sm" disabled={updateProfileMutation.isPending} className="text-xs font-semibold px-4">
                    {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-5 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Public Visibility
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-foreground">Public Metrics</div>
                  <div className="text-[11px] text-muted-foreground">Show aggregate organization metrics on your public profile.</div>
                </div>
                <Switch checked={publicMetricsEnabled} onCheckedChange={setPublicMetricsEnabled} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-foreground">Public Project Gallery</div>
                  <div className="text-[11px] text-muted-foreground">Allow challenge submissions to be showcased publicly (with participant consent).</div>
                </div>
                <Switch checked={publicProjectGalleryEnabled} onCheckedChange={setPublicProjectGalleryEnabled} />
              </div>
              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={handleSaveSettings} disabled={updateSettingsMutation.isPending} className="text-xs font-semibold px-4">
                  {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="p-5 border-b border-border/60">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Ownership Transfer
              </CardTitle>
              <CardDescription className="text-xs">
                Transferring ownership is irreversible — you will be retained as an ORG_ADMIN.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {canTransferOwnership ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTransferModalOpen(true)}
                  className="text-xs font-semibold text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5"
                >
                  <Crown className="h-3.5 w-3.5" />
                  <span>Transfer Organization Ownership</span>
                </Button>
              ) : (
                <div className="p-3 rounded-xl border border-border bg-muted/30 flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>Only the current ORG_OWNER can initiate ownership transfers.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {canArchiveOrganization && (
            <Card className="border-destructive/30">
              <CardHeader className="p-5 border-b border-destructive/20">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-destructive">
                  <Archive className="h-4 w-4" />
                  Danger Zone
                </CardTitle>
                <CardDescription className="text-xs">
                  Archiving is irreversible from this portal — the organization becomes inactive and its challenges/data are frozen.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setArchiveModalOpen(true)}
                  className="text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>Archive Organization</span>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Crown className="h-5 w-5" />
                Transfer Organization Ownership
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                This relinquishes your sole ORG_OWNER authority.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Select New Owner</label>
                <Select value={targetOwnerId} onValueChange={setTargetOwnerId}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Choose a member..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleNewOwners.map((m) => (
                      <SelectItem key={m.userId} value={m.userId} className="text-xs">
                        {m.displayName || "Unnamed member"} — {m.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Reason</label>
                <Input value={transferReason} onChange={(e) => setTransferReason(e.target.value)} className="text-xs h-9" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Type <span className="font-mono text-destructive">TRANSFER OWNERSHIP</span> to confirm
                </label>
                <Input value={confirmPhrase} onChange={(e) => setConfirmPhrase(e.target.value)} placeholder="TRANSFER OWNERSHIP" className="text-xs h-9 font-mono uppercase" required />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setTransferModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleTransferOwnership}
                disabled={confirmPhrase !== "TRANSFER OWNERSHIP" || !targetOwnerId || transferOwnershipMutation.isPending}
                className="text-xs font-semibold px-4 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {transferOwnershipMutation.isPending ? "Transferring..." : "Confirm Transfer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={archiveModalOpen} onOpenChange={setArchiveModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
                <Archive className="h-5 w-5" />
                Archive Organization
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                This freezes "{org?.name}" — its challenges, submissions, and member access become inactive. This cannot be undone from this portal.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Reason (min. 10 characters)</label>
                <Textarea value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} className="text-xs min-h-[70px]" required />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Type <span className="font-mono text-destructive">ARCHIVE ORGANIZATION</span> to confirm
                </label>
                <Input value={archiveConfirmPhrase} onChange={(e) => setArchiveConfirmPhrase(e.target.value)} placeholder="ARCHIVE ORGANIZATION" className="text-xs h-9 font-mono uppercase" required />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button variant="ghost" size="sm" onClick={() => setArchiveModalOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleArchiveOrganization}
                disabled={archiveConfirmPhrase !== "ARCHIVE ORGANIZATION" || archiveReason.trim().length < 10 || archiveOrgMutation.isPending}
                className="text-xs font-semibold px-4"
              >
                {archiveOrgMutation.isPending ? "Archiving..." : "Confirm Archive"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </OrgAccessGuard>
  );
}
