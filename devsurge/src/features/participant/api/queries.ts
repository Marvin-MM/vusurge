import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiArray, apiPost, apiPatch } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { newIdempotencyKey } from "@/lib/idempotency";
import { ParticipationRecord, MyParticipationSummary, TeamInvitation, OrganizationApplication, FormFieldDefinition } from "@/types";

// --- Challenge participation (org + challenge scoped) -----------------------

export function useMyParticipation(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "participation", "me"],
    queryFn: () =>
      apiGet<ParticipationRecord | null>(
        `/organizations/${organizationId}/challenges/${challengeId}/participation/me`
      ),
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useRegisterForChallenge(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload?: { acceptTermsVersionId?: string; formResponseId?: string }) =>
      apiPost<ParticipationRecord>(
        `/organizations/${organizationId}/challenges/${challengeId}/participation/register`,
        payload ?? {}
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "challenges", challengeId, "participation", "me"],
      });
      queryClient.invalidateQueries({ queryKey: ["me", "challenge-participations"] });
    },
  });
}

/** The challenge's published CHALLENGE_PARTICIPATION screening-form schema,
 * or null if none is configured/published yet. Deliberately not routed
 * through the generic forms module (`organization.view_private`, i.e.
 * active membership) — screening can apply to a genuinely non-member
 * applicant (`participationPolicy: 'OPEN_AUTHENTICATED'` + `screeningRequired`
 * is a real, valid combination) — see `participation.service.ts`'s
 * `getApplicationForm`. A `null` value serializes as an empty response body,
 * not the literal JSON `null`, so treat any falsy result as "no form." */
export interface ParticipationApplicationForm {
  formDefinitionId: string;
  fields: FormFieldDefinition[];
}

export function useParticipationApplicationForm(organizationId: string, challengeId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "challenges", challengeId, "participation", "application-form"],
    queryFn: async () => {
      const result = await apiGet<ParticipationApplicationForm | "">(
        `/organizations/${organizationId}/challenges/${challengeId}/participation/application-form`
      );
      return result || null;
    },
    enabled: Boolean(organizationId) && Boolean(challengeId),
  });
}

export function useSaveParticipationApplication(organizationId: string, challengeId: string) {
  return useMutation({
    mutationFn: (responseData: Record<string, unknown>) =>
      apiPatch<{ id: string; formVersionId: string; responseData: Record<string, unknown> }>(
        `/organizations/${organizationId}/challenges/${challengeId}/participation/application`,
        { responseData }
      ),
  });
}

export function useSubmitParticipationApplication(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { responseData: Record<string, unknown>; acceptTermsVersionId?: string }) =>
      apiPost<ParticipationRecord>(
        `/organizations/${organizationId}/challenges/${challengeId}/participation/submit-application`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "challenges", challengeId, "participation", "me"],
      });
      queryClient.invalidateQueries({ queryKey: ["me", "challenge-participations"] });
    },
  });
}

export function useWithdrawParticipation(organizationId: string, challengeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<ParticipationRecord>(`/organizations/${organizationId}/challenges/${challengeId}/participation/withdraw`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["organizations", organizationId, "challenges", challengeId, "participation", "me"],
      });
      queryClient.invalidateQueries({ queryKey: ["me", "challenge-participations"] });
    },
  });
}

// --- Cross-challenge "my stuff" (the actual "/me/*" aggregate endpoints) ---

export function useMyChallengeParticipations() {
  return useQuery({
    queryKey: ["me", "challenge-participations"],
    queryFn: () => apiArray<MyParticipationSummary>("/me/challenge-participations"),
  });
}

export function useMyTeamInvitations() {
  return useQuery({
    queryKey: ["me", "team-invitations"],
    queryFn: () => apiArray<TeamInvitation>("/me/team-invitations"),
  });
}

export function useMyOrganizationJoinRequests() {
  return useCursorList<{
    id: string;
    organizationId: string;
    userId: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
    message: string | null;
    reviewedAt: string | null;
    decisionReason: string | null;
    createdAt: string;
  }>(["me", "organization-join-requests"], "/me/organization-join-requests");
}

export function useMyOrganizationApplications() {
  return useQuery({
    queryKey: ["me", "organization-applications"],
    queryFn: () => apiArray<OrganizationApplication>("/me/organization-applications"),
  });
}

// Notification hooks live in src/features/notifications/api/queries.ts
// (the established location with existing consumers) — not duplicated here.

// --- Join codes / join requests ----------------------------------------------

export function useRedeemJoinCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiPost<{ organizationId: string; organizationSlug: string }>("/join-codes/redeem", { code }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "memberships"] });
    },
  });
}

export function useSubmitJoinRequest(organizationId: string) {
  return useMutation({
    mutationFn: (payload: { message?: string }) => apiPost(`/organizations/${organizationId}/join-requests`, payload),
  });
}

// --- Organization applications ("host a challenge" flow) --------------------

export interface OrganizationApplicationPayload {
  name: string;
  requestedSlug: string;
  organizationType: string;
  description: string;
  websiteUrl?: string;
  country?: string;
  region?: string;
  affiliatedInstitution?: string;
  requesterRelationship: string;
  requestedVisibility: "PRIVATE" | "PUBLIC";
  acceptedTermsVersion: string;
}

export function useSubmitOrganizationApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrganizationApplicationPayload) =>
      apiPost<OrganizationApplication>("/organization-applications", payload, {
        headers: { "idempotency-key": newIdempotencyKey() },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me", "organization-applications"] });
    },
  });
}
