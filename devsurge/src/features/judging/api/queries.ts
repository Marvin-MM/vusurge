import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiArray, apiPatch, apiPost } from "@/api/client/axiosClient";
import { JudgeAssignment, Scorecard, ScorecardCriterionScore, Rubric, RubricVersion, Submission } from "@/types";

// =============================================================================
// The caller's own judge assignments (cross-organization — a judge may be
// assigned to challenges across several orgs, all surfaced from one endpoint).
// =============================================================================

export function useMyJudgeAssignments() {
  return useQuery({
    queryKey: ["judging", "my-assignments"],
    queryFn: () => apiArray<JudgeAssignment>("/judging/assignments"),
  });
}

export function useJudgeAssignment(assignmentId: string) {
  return useQuery({
    queryKey: ["judging", "assignment", assignmentId],
    queryFn: () => apiGet<JudgeAssignment>(`/judging/assignments/${assignmentId}`),
    enabled: Boolean(assignmentId),
  });
}

export function useDeclareConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => apiPost<JudgeAssignment>(`/judging/assignments/${assignmentId}/declare-conflict`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["judging"] }),
  });
}

export function useRecuseAssignment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (assignmentId: string) => apiPost<JudgeAssignment>(`/judging/assignments/${assignmentId}/recuse`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["judging"] }),
  });
}

// =============================================================================
// Scorecards — GET auto-resolves (or creates) the draft scorecard tied to the
// assignment's currently active rubric version.
// =============================================================================

export function useAssignmentScorecard(assignmentId: string) {
  return useQuery({
    queryKey: ["judging", "scorecard", assignmentId],
    queryFn: () => apiGet<Scorecard>(`/judging/assignments/${assignmentId}/scorecard`),
    enabled: Boolean(assignmentId),
  });
}

export function useSaveScorecardDraft(assignmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (criterionScores: ScorecardCriterionScore[]) =>
      apiPatch<Scorecard>(`/judging/assignments/${assignmentId}/scorecard`, { criterionScores }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["judging", "scorecard", assignmentId] }),
  });
}

export function useSubmitScorecard(assignmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (criterionScores: ScorecardCriterionScore[]) =>
      apiPost<Scorecard>(`/judging/assignments/${assignmentId}/scorecard/submit`, { criterionScores }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["judging", "scorecard", assignmentId] });
      queryClient.invalidateQueries({ queryKey: ["judging", "my-assignments"] });
    },
  });
}

// =============================================================================
// The submission a judge is scoring — real access is granted purely by
// holding an active judge assignment for that exact submission, independent
// of org membership.
// =============================================================================

export function useJudgedSubmission(organizationId: string, challengeId: string, submissionId: string) {
  return useQuery({
    queryKey: ["judging", "submission", organizationId, challengeId, submissionId],
    queryFn: () => apiGet<Submission>(`/organizations/${organizationId}/challenges/${challengeId}/submissions/${submissionId}`),
    enabled: Boolean(organizationId && challengeId && submissionId),
  });
}

// =============================================================================
// Rubric criteria for the scorecard being filled in. A scorecard only carries
// `rubricVersionId`, not the criteria themselves — resolve it by listing the
// challenge's rubric(s) and their versions until the matching version is found.
// =============================================================================

export function useScorecardRubricVersion(organizationId: string, challengeId: string, rubricVersionId: string | undefined) {
  return useQuery({
    queryKey: ["judging", "rubric-version", organizationId, challengeId, rubricVersionId],
    queryFn: async (): Promise<RubricVersion | null> => {
      const rubrics = await apiArray<Rubric>(`/organizations/${organizationId}/challenges/${challengeId}/rubrics`);
      for (const rubric of rubrics) {
        const versions = await apiArray<RubricVersion>(
          `/organizations/${organizationId}/challenges/${challengeId}/rubrics/${rubric.id}/versions`,
        );
        const match = versions.find((v) => v.id === rubricVersionId);
        if (match) return match;
      }
      return null;
    },
    enabled: Boolean(organizationId && challengeId && rubricVersionId),
  });
}
