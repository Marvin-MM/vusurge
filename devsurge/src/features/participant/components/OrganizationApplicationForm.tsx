import * as React from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubmitOrganizationApplication } from "@/features/participant/api/queries";
import { toast } from "sonner";

const CURRENT_TERMS_VERSION = "1.0";

interface OrganizationApplicationFormProps {
  onSubmitted?: () => void;
}

export function OrganizationApplicationForm({ onSubmitted }: OrganizationApplicationFormProps) {
  const submitMutation = useSubmitOrganizationApplication();

  const [name, setName] = React.useState("");
  const [requestedSlug, setRequestedSlug] = React.useState("");
  const [organizationType, setOrganizationType] = React.useState("ENTERPRISE");
  const [websiteUrl, setWebsiteUrl] = React.useState("");
  const [country, setCountry] = React.useState("");
  const [affiliatedInstitution, setAffiliatedInstitution] = React.useState("");
  const [requesterRelationship, setRequesterRelationship] = React.useState("");
  const [requestedVisibility, setRequestedVisibility] = React.useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [description, setDescription] = React.useState("");
  const [termsAccepted, setTermsAccepted] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    setRequestedSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !requesterRelationship.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!termsAccepted) {
      toast.error("You must accept the Organization Host Agreement.");
      return;
    }
    submitMutation.mutate(
      {
        name,
        requestedSlug,
        organizationType,
        description,
        websiteUrl: websiteUrl || undefined,
        country: country || undefined,
        affiliatedInstitution: affiliatedInstitution || undefined,
        requesterRelationship,
        requestedVisibility,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
      },
      {
        onSuccess: () => {
          setSubmitted(true);
          onSubmitted?.();
        },
        onError: (err: any) => toast.error(err?.message || "Failed to submit application."),
      }
    );
  };

  if (submitted) {
    return (
      <Card className="p-8 max-w-2xl mx-auto text-center space-y-4 border-emerald-500/30 bg-emerald-500/5">
        <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Application Submitted</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Thank you for applying to host <strong>{name}</strong> on DevArena. The platform team will review your
          application and notify you of the decision.
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-border p-6 space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Organization Name *</label>
          <Input placeholder="e.g. Stanford Autonomous Systems Lab" value={name} onChange={(e) => handleNameChange(e.target.value)} className="text-xs h-9" required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">URL Slug *</label>
            <Input value={requestedSlug} onChange={(e) => setRequestedSlug(e.target.value)} className="text-xs h-9 font-mono" required />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Website URL</label>
            <Input placeholder="https://example.edu" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="text-xs h-9" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Organization Type</label>
            <Select value={organizationType} onValueChange={setOrganizationType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ENTERPRISE">Enterprise / Corporation</SelectItem>
                <SelectItem value="UNIVERSITY">University / Academic Institution</SelectItem>
                <SelectItem value="RESEARCH_LAB">Research Lab</SelectItem>
                <SelectItem value="NON_PROFIT">Non-Profit / Foundation</SelectItem>
                <SelectItem value="STARTUP">Startup</SelectItem>
                <SelectItem value="COMMUNITY">Community Group</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Visibility</label>
            <Select value={requestedVisibility} onValueChange={(v) => setRequestedVisibility(v as "PUBLIC" | "PRIVATE")}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Public — listed in the directory</SelectItem>
                <SelectItem value="PRIVATE">Private — invite only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Country</label>
            <Input value={country} onChange={(e) => setCountry(e.target.value)} className="text-xs h-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Affiliated Institution</label>
            <Input value={affiliatedInstitution} onChange={(e) => setAffiliatedInstitution(e.target.value)} className="text-xs h-9" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Your Relationship to This Organization *</label>
          <Input placeholder="e.g. Founder, Faculty Advisor, Program Director" value={requesterRelationship} onChange={(e) => setRequesterRelationship(e.target.value)} className="text-xs h-9" required />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Organization Description *</label>
          <Textarea placeholder="Describe your organization and the kinds of challenges you plan to host..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="text-xs leading-relaxed" required />
        </div>

        <label className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card cursor-pointer">
          <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4" />
          <div className="space-y-0.5 text-xs text-foreground">
            <span className="font-bold">I agree to the DevArena Organization Host Agreement</span>
          </div>
        </label>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={submitMutation.isPending || !termsAccepted} className="text-xs font-semibold gap-1.5">
          <Send className="h-3.5 w-3.5" />
          <span>{submitMutation.isPending ? "Submitting..." : "Submit Application"}</span>
        </Button>
      </div>
    </form>
  );
}
