import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiArray, apiPost, apiPatch } from "@/api/client/axiosClient";
import { newIdempotencyKey } from "@/lib/idempotency";
import { Submission, SubmissionVersion } from "@/types";

// Submissions are always scoped under an organization + challenge (never a
// flat top-level collection). A submission's editable content lives in its
// `draftVersion` — see the `PATCH .../draft` mutation below.

export function useSubmission(organizationId: string, challengeId: string, submissionId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions", submissionId],
    queryFn: () =>
      apiGet<Submission>(`/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}`),
    enabled: Boolean(organizationId) && Boolean(challengeId) && Boolean(submissionId),
    refetchInterval: (query) =>
      query.state.data?.presentationFiles?.some(
        (file) => file.scanStatus === "QUARANTINED" || file.scanStatus === "PENDING_UPLOAD",
      )
        ? 3_000
        : false,
  });
}

/** The signed-in user's own submission for this challenge — null if none exists yet. */
export function useMySubmission(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions", "me"],
    queryFn: () => apiGet<Submission | null>(`/organizations/${organizationId}/challenges/${challengeId}/submissions/me`),
    enabled: Boolean(organizationId) && Boolean(challengeId),
    refetchInterval: (query) =>
      query.state.data?.presentationFiles?.some(
        (file) => file.scanStatus === "QUARANTINED" || file.scanStatus === "PENDING_UPLOAD",
      )
        ? 3_000
        : false,
  });
}

export interface SubmissionFeedback {
  criterionScores: { criterionKey: string; score: number; comment?: string }[];
  totalScore: number | null;
  maxPossibleScore: number | null;
}

/** Released judge feedback for a submission — empty until the organizer releases it. */
export function useSubmissionFeedback(organizationId: string, challengeId: string, submissionId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions", submissionId, "feedback"],
    queryFn: async () => {
      try {
        return await apiArray<SubmissionFeedback>(
          `/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/feedback`
        );
      } catch (err: any) {
        // 409 here means "feedback not released yet" — an expected, common
        // state for most submissions, not a failure.
        if (err?.status === 409) return [];
        throw err;
      }
    },
    enabled: Boolean(organizationId) && Boolean(challengeId) && Boolean(submissionId),
  });
}

export function useSubmissionVersions(organizationId: string, challengeId: string, submissionId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions", submissionId, "versions"],
    queryFn: () =>
      apiArray<SubmissionVersion>(
        `/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/versions`
      ),
    enabled: Boolean(organizationId) && Boolean(challengeId) && Boolean(submissionId),
  });
}

/** Creates the submission shell (empty draft) — a team can only have one per challenge. */
/**
 * Starts (or returns) the caller's own submission for this challenge. The
 * backend resolves the owning team from the caller's own approved
 * participation and declares no request body at all — a submission can never
 * be opened on behalf of another team, so this deliberately sends nothing.
 */
export function useCreateSubmission(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiPost<Submission>(`/organizations/${organizationId}/challenges/${challengeId}/submissions`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions"] });
    },
  });
}

export interface SubmissionDraftPayload {
  title?: string;
  tagline?: string;
  problemStatement?: string;
  solutionDescription?: string;
  impactBeneficiaries?: string;
  technologyTags?: string[];
  repositoryUrl?: string;
  demoUrl?: string;
  pitchVideoUrl?: string;
  presentationUrl?: string;
  supportingLinks?: { label: string; url: string }[];
  publicationConsent?: boolean;
  termsVersionId?: string;
  screenshotAssetIds?: string[];
}

/**
 * The submission id is passed per-call (not baked in at hook-creation time)
 * because the very first save often has to create the submission shell
 * first, in the same handler, before an id exists to bind a hook to.
 */
export function useUpdateSubmissionDraft(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, payload }: { submissionId: string; payload: SubmissionDraftPayload }) =>
      apiPatch<Submission>(
        `/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/draft`,
        payload
      ),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions", variables.submissionId],
      });
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions", "me"],
      });
    },
  });
}

export function useFinalizeSubmission(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (submissionId: string) =>
      apiPost<Submission>(
        `/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}/finalize`,
        undefined,
        { headers: { "idempotency-key": newIdempotencyKey() } }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "challenges", challengeId, "submissions"] });
    },
  });
}
