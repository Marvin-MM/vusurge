import * as React from "react";
import { toast } from "sonner";
import {
  useMyParticipation,
  useRegisterForChallenge,
  useSubmitParticipationApplication,
  useParticipationApplicationForm,
  useWithdrawParticipation,
} from "@/features/participant/api/queries";

/**
 * Shared registration/screening-application state machine, used by both the
 * public challenge page (organizationId resolved from the org lookup, no
 * ChallengeView permission required) and the authenticated workspace page.
 * Kept as a hook rather than a UI component because the two pages render
 * this state with materially different layouts (a compact sidebar card vs.
 * a full-width lifecycle bar).
 */
export function useChallengeParticipationFlow(organizationId: string, challengeId: string) {
  const { data: participation } = useMyParticipation(organizationId, challengeId);
  const { data: applicationForm } = useParticipationApplicationForm(organizationId, challengeId);

  const registerMutation = useRegisterForChallenge(organizationId, challengeId);
  const submitApplicationMutation = useSubmitParticipationApplication(organizationId, challengeId);
  const withdrawMutation = useWithdrawParticipation(organizationId, challengeId);

  const [applicationDialogOpen, setApplicationDialogOpen] = React.useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = React.useState(false);

  const handleRegister = () => {
    // A published screening form is the operative signal for whether this
    // challenge needs an application — not a `screeningRequired` flag, which
    // isn't part of the public projection. If the backend disagrees (e.g.
    // screening is required but no form has been published yet), register()
    // rejects with a clear conflict message surfaced via the error toast.
    if (applicationForm) {
      setApplicationDialogOpen(true);
      return;
    }
    registerMutation.mutate(
      {},
      {
        onSuccess: () => toast.success("You're registered!"),
        onError: (err: any) => toast.error(err?.message || "Could not complete registration."),
      }
    );
  };

  const handleSubmitApplication = async (responseData: Record<string, unknown>) => {
    await submitApplicationMutation.mutateAsync(
      { responseData },
      {
        onSuccess: () => {
          toast.success("Application submitted.");
          setApplicationDialogOpen(false);
        },
        onError: (err: any) => toast.error(err?.message || "Could not submit application."),
      }
    );
  };

  const handleConfirmWithdraw = () => {
    withdrawMutation.mutate(undefined, {
      onSuccess: () => {
        setWithdrawDialogOpen(false);
        toast.info("You have withdrawn from this challenge.");
      },
      onError: (err: any) => toast.error(err?.message || "Could not withdraw."),
    });
  };

  return {
    participation,
    applicationForm,
    registerMutation,
    submitApplicationMutation,
    withdrawMutation,
    applicationDialogOpen,
    setApplicationDialogOpen,
    withdrawDialogOpen,
    setWithdrawDialogOpen,
    handleRegister,
    handleSubmitApplication,
    handleConfirmWithdraw,
  };
}
