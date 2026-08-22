import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiArray, apiPost, apiPatch } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { FormDefinition, FormVersion, FormResponseEntry, FormSchema, FormPurpose } from "@/types";

// =============================================================================
// Form definitions — `backend/src/modules/forms`. Reads only need
// organization.view_private (any active member); writes need
// organization.manage_forms (CHALLENGE_MANAGER+). A form's actual question
// set lives on its versions, not the definition itself — see below.
// =============================================================================

export function useFormDefinitions(organizationId: string, filters?: { purpose?: FormPurpose; challengeId?: string }) {
  return useCursorList<FormDefinition>(
    ["organizations", organizationId, "forms", filters],
    `/organizations/${organizationId}/forms`,
    { purpose: filters?.purpose, challengeId: filters?.challengeId }
  );
}

export function useFormDefinition(organizationId: string, formId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "forms", formId],
    queryFn: () => apiGet<FormDefinition>(`/organizations/${organizationId}/forms/${formId}`),
    enabled: Boolean(organizationId) && Boolean(formId),
  });
}

export function useCreateFormDefinition(organizationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { purpose: FormPurpose; challengeId?: string; name: string }) =>
      apiPost<FormDefinition>(`/organizations/${organizationId}/forms`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "forms"] });
    },
  });
}

export function useUpdateFormDefinition(organizationId: string, formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => apiPatch<FormDefinition>(`/organizations/${organizationId}/forms/${formId}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "forms"] });
    },
  });
}

// =============================================================================
// Form versions — a new version is a full replacement schema; only one
// version can be the (published) live one at a time. `FormVersionListResponse`
// is a bare array, not a cursor page (see forms.dto.ts).
// =============================================================================

export function useFormVersions(organizationId: string, formId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "forms", formId, "versions"],
    queryFn: () => apiArray<FormVersion>(`/organizations/${organizationId}/forms/${formId}/versions`),
    enabled: Boolean(organizationId) && Boolean(formId),
  });
}

export function useFormVersion(organizationId: string, formId: string, versionId: string) {
  return useQuery({
    queryKey: ["organizations", organizationId, "forms", formId, "versions", versionId],
    queryFn: () => apiGet<FormVersion>(`/organizations/${organizationId}/forms/${formId}/versions/${versionId}`),
    enabled: Boolean(organizationId) && Boolean(formId) && Boolean(versionId),
  });
}

export function useCreateFormVersion(organizationId: string, formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (schema: FormSchema) =>
      apiPost<FormVersion>(`/organizations/${organizationId}/forms/${formId}/versions`, { schema }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "forms", formId, "versions"] });
    },
  });
}

export function usePublishFormVersion(organizationId: string, formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (versionId: string) =>
      apiPost<FormVersion>(`/organizations/${organizationId}/forms/${formId}/versions/${versionId}/publish`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "forms", formId, "versions"] });
    },
  });
}

/** The form's currently live version, resolved client-side from the version
 * list — the backend has no dedicated "get published version" endpoint. */
export function usePublishedFormVersion(organizationId: string, formId: string) {
  const query = useFormVersions(organizationId, formId);
  const published = query.data?.find((v) => v.isPublished) ?? null;
  return { ...query, published };
}

// =============================================================================
// Form responses — submitting only needs organization.view_private (any
// active member); the submission always targets the form's current
// published version, resolved server-side (no versionId to pass). Viewing
// the response list needs organization.manage_forms.
// =============================================================================

export function useFormResponses(organizationId: string, formId: string, options?: { enabled?: boolean }) {
  return useCursorList<FormResponseEntry>(
    ["organizations", organizationId, "forms", formId, "responses"],
    `/organizations/${organizationId}/forms/${formId}/responses`,
    undefined,
    options
  );
}

export function useSubmitFormResponse(organizationId: string, formId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (responseData: Record<string, unknown>) =>
      apiPost<FormResponseEntry>(`/organizations/${organizationId}/forms/${formId}/responses`, { responseData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "forms", formId, "responses"] });
    },
  });
}
