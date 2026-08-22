import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Flag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { useFileReport } from "@/features/moderation/api/queries";
import { ModerationCategory, ModerationTargetType } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CATEGORY_OPTIONS: { value: ModerationCategory; label: string }[] = [
  { value: "SPAM", label: "Spam" },
  { value: "ABUSE", label: "Abuse or Harassment" },
  { value: "INAPPROPRIATE_CONTENT", label: "Inappropriate Content" },
  { value: "INTELLECTUAL_PROPERTY", label: "Intellectual Property Violation" },
  { value: "SAFETY_CONCERN", label: "Safety Concern" },
  { value: "OTHER", label: "Other" },
];

const MIN_DESCRIPTION_LENGTH = 10;
const MAX_DESCRIPTION_LENGTH = 2000;

export interface ReportContentDialogProps {
  /** What's being reported — matches the backend's `ContentReportTargetType`. */
  targetType: ModerationTargetType;
  /** UUID of the organization or challenge being reported. */
  targetId: string;
  /** Human-readable name shown in the dialog copy (e.g. the challenge title or org name). */
  targetLabel: string;
  /** Extra classes for the trigger button, so it can blend into light or dark surrounding UI. */
  triggerClassName?: string;
}

/**
 * A "Report" trigger + dialog usable on any public challenge or organization
 * page. Filing a report requires a signed-in, verified session
 * (`requireAuth: true` + `requireVerifiedActor` on `POST /reports`) — an
 * anonymous visitor is sent to sign in with a `returnTo` back to this page
 * rather than the trigger being hidden, mirroring the "Sign In to Your
 * Account" pattern already used for registration on PublicChallengeDetailPage.
 */
export function ReportContentDialog({ targetType, targetId, targetLabel, triggerClassName }: ReportContentDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<ModerationCategory | "">("");
  const [description, setDescription] = React.useState("");

  const fileReport = useFileReport();

  const handleTriggerClick = () => {
    if (!user) {
      const returnTo = `${location.pathname}${location.search}`;
      navigate(`/auth/signin?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    setOpen(true);
  };

  const resetForm = () => {
    setCategory("");
    setDescription("");
  };

  const canSubmit = category !== "" && description.trim().length >= MIN_DESCRIPTION_LENGTH;

  const handleSubmit = () => {
    if (!canSubmit) return;
    fileReport.mutate(
      { targetType, targetId, category, description: description.trim() },
      {
        onSuccess: () => {
          toast.success("Report submitted. Our platform team will review it shortly.");
          setOpen(false);
          resetForm();
        },
        onError: (err: any) => toast.error(err?.message || "Failed to submit report."),
      },
    );
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn("text-xs gap-1.5 text-muted-foreground hover:text-destructive", triggerClassName)}
        onClick={handleTriggerClick}
      >
        <Flag className="h-3.5 w-3.5" />
        <span>Report</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-full bg-destructive/10 text-destructive">
                <Flag className="h-5 w-5" />
              </div>
              <DialogTitle className="text-base">Report {targetLabel}</DialogTitle>
            </div>
            <DialogDescription className="text-xs pt-1">
              Let our platform team know what's wrong. Reports are reviewed by platform moderators, not the
              organization itself.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as ModerationCategory)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
                placeholder="Describe the issue in at least 10 characters..."
                rows={4}
                className="text-xs"
              />
              <div className="text-[10px] text-muted-foreground text-right">
                {description.trim().length}/{MAX_DESCRIPTION_LENGTH}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={fileReport.isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={!canSubmit} loading={fileReport.isPending}>
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
