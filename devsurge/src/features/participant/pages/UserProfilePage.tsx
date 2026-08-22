import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { PageContainer, PageHeader } from "@/components/shared/PageContainer";
import { useAuth } from "@/context/AuthContext";
import { useUserProfile, useUpdateProfile, useUpdateSkills } from "@/features/users/api/queries";
import { useAssetUrl } from "@/lib/assetUrl";
import { useUploadImage } from "@/lib/imageUpload";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export function UserProfilePage() {
  const { user } = useAuth();
  const { data: profile } = useUserProfile(user?.id);
  const { url: avatarUrl } = useAssetUrl(profile?.avatarAssetId, "authenticated");
  const updateProfile = useUpdateProfile();
  const updateSkills = useUpdateSkills();
  const uploadImageMutation = useUploadImage();
  const avatarInputRef = React.useRef<HTMLInputElement>(null);

  const handleAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    uploadImageMutation.mutate(
      { purpose: "USER_AVATAR", file },
      {
        onSuccess: (assetId) =>
          updateProfile.mutate(
            { avatarAssetId: assetId },
            { onSuccess: () => toast.success("Avatar updated."), onError: (err: any) => toast.error(err?.message || "Failed to save avatar.") },
          ),
        onError: (err: any) => toast.error(err?.message || "Failed to upload avatar."),
      },
    );
  };

  const [bio, setBio] = React.useState("");
  const [githubUrl, setGithubUrl] = React.useState("");
  const [linkedinUrl, setLinkedinUrl] = React.useState("");
  const [portfolioUrl, setPortfolioUrl] = React.useState("");
  const [newSkill, setNewSkill] = React.useState("");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    if (profile && !hydrated) {
      setBio(profile.bio || "");
      setGithubUrl(profile.githubUrl || "");
      setLinkedinUrl(profile.linkedinUrl || "");
      setPortfolioUrl(profile.portfolioUrl || "");
      setHydrated(true);
    }
  }, [profile, hydrated]);

  const catalogSkillIds = (profile?.skills || []).filter((s) => !s.isCustom && s.id).map((s) => s.id as string);
  const customSkillNames = (profile?.skills || []).filter((s) => s.isCustom).map((s) => s.name);

  const handleAddCustomSkill = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSkill.trim();
    if (!trimmed || customSkillNames.includes(trimmed)) return;
    updateSkills.mutate(
      { skillIds: catalogSkillIds, customNames: [...customSkillNames, trimmed] },
      { onSuccess: () => setNewSkill("") }
    );
  };

  const handleRemoveSkill = (name: string) => {
    updateSkills.mutate({
      skillIds: catalogSkillIds,
      customNames: customSkillNames.filter((s) => s !== name),
    });
  };

  const handleSaveProfile = () => {
    updateProfile.mutate(
      { bio, githubUrl, linkedinUrl, portfolioUrl },
      {
        onSuccess: () => toast.success("Profile saved."),
        onError: (err: any) => toast.error(err?.message || "Failed to save profile."),
      }
    );
  };

  return (
    <PageContainer className="space-y-6">
      <PageHeader title="Profile" description="Your public profile and skills — used for team matchmaking discovery." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 space-y-4 text-center md:text-left flex flex-col items-center md:items-start">
          <Avatar className="h-24 w-24 ring-2 ring-primary/40">
            <AvatarImage src={avatarUrl} alt={user?.fullName} referrerPolicy="no-referrer" />
            <AvatarFallback className="text-xl font-bold">{(user?.fullName || user?.email || "?").slice(0, 2)}</AvatarFallback>
          </Avatar>

          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelected} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploadImageMutation.isPending}
            onClick={() => avatarInputRef.current?.click()}
            className="text-xs gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" />
            {uploadImageMutation.isPending ? "Uploading..." : "Change Photo"}
          </Button>

          <div className="space-y-1">
            <h2 className="text-xl font-bold text-foreground">{user?.fullName || user?.email}</h2>
            <div className="text-xs text-muted-foreground">{user?.email}</div>
          </div>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card className="p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Skills</h3>
            <p className="text-xs text-muted-foreground">Used for team matchmaking recommendations.</p>

            <div className="flex flex-wrap gap-2 pt-2">
              {(profile?.skills || []).map((s) => (
                <div key={s.id ?? s.name} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-xs font-semibold text-foreground">
                  <span>{s.name}</span>
                  {s.isCustom && (
                    <button onClick={() => handleRemoveSkill(s.name)} className="text-muted-foreground hover:text-destructive text-xs cursor-pointer">×</button>
                  )}
                </div>
              ))}
            </div>

            <form onSubmit={handleAddCustomSkill} className="flex gap-2 pt-2">
              <Input value={newSkill} onChange={(e) => setNewSkill(e.target.value)} placeholder="Add a skill..." className="text-xs h-9" />
              <Button type="submit" size="sm" disabled={updateSkills.isPending} className="text-xs font-semibold shrink-0">Add</Button>
            </form>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="text-base font-bold text-foreground">Bio & Links</h3>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder="Tell teammates about your background..."
              className="w-full rounded-md border border-input bg-background p-3 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="GitHub URL" className="text-xs h-9" />
              <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="LinkedIn URL" className="text-xs h-9" />
              <Input value={portfolioUrl} onChange={(e) => setPortfolioUrl(e.target.value)} placeholder="Portfolio URL" className="text-xs h-9" />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveProfile} disabled={updateProfile.isPending} className="text-xs font-semibold">
                {updateProfile.isPending ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
