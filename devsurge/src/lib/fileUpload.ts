import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { apiPost, apiGet, apiDelete } from "@/api/client/axiosClient";

/**
 * The "files" module (`backend/src/modules/files/`) handles private,
 * malware-scanned documents — distinct from the public-image Cloudinary
 * pipeline under `media/images/*` (see `src/lib/assetUrl.ts`). It is used
 * for exactly four purposes (backend/docs/openapi.json:
 * POST /files/upload-authorization). FORM_ATTACHMENT's `resourceId` is the
 * form *definition* id (not a response id — responses aren't pre-created
 * before their attachment is uploaded), and downloading one is staff-only
 * (`organization.manage_forms`) — the backend's resource-level authorizer
 * only knows the form, not which respondent a given file belongs to, so a
 * respondent cannot re-download their own submitted attachment through this
 * endpoint.
 */
export type PrivateFilePurpose = "SUBMISSION_PRESENTATION" | "SUPPORT_ATTACHMENT" | "PORTFOLIO_EVIDENCE" | "FORM_ATTACHMENT";

interface PrivateFileUploadAuthorization {
  storedObjectId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export interface PrivateFileAsset {
  id: string;
  purpose: PrivateFilePurpose;
  resourceType: string;
  resourceId: string;
  displayName: string;
  status: "ACTIVE" | "PENDING_DELETION" | "DELETED";
  /**
   * `QUARANTINED` is the state every newly confirmed file starts in — it
   * means "awaiting the async malware scan," not "found infected." Only
   * `CLEAN` is downloadable; `INFECTED`/`FAILED` never become available.
   */
  scanStatus: "QUARANTINED" | "CLEAN" | "INFECTED" | "FAILED";
  createdAt: string;
}

export interface UploadPrivateFileInput {
  purpose: PrivateFilePurpose;
  organizationId: string;
  /** The purpose-specific resource this file is bound to — e.g. the submission
   * *version* id for SUBMISSION_PRESENTATION, or the ticket id for
   * SUPPORT_ATTACHMENT (see RESOURCE_TYPE in backend/src/modules/files/files.service.ts). */
  resourceId: string;
  /** Required for SUBMISSION_PRESENTATION; the backend 400s without it. */
  challengeId?: string;
  file: File;
}

/**
 * The 3-step private-upload flow: authorize -> direct PUT to signed object
 * storage -> confirm. Mirrors the existing 3-step Cloudinary flow used for
 * public images (`media/images/upload-authorization` -> direct upload ->
 * `media/images/confirm`, see backend/src/modules/media/media.route.ts) but
 * for private documents that get queued for malware scanning on confirm.
 *
 * The returned asset is never immediately downloadable — it starts
 * `QUARANTINED` and only becomes `CLEAN` once the async scan (backend
 * worker + ClamAV) clears it. Callers must handle that pending state
 * gracefully rather than assuming the file is available right away; see
 * {@link requestPrivateFileDownload}.
 */
export async function uploadPrivateFile(input: UploadPrivateFileInput): Promise<PrivateFileAsset> {
  const { purpose, organizationId, resourceId, challengeId, file } = input;

  const authorization = await apiPost<PrivateFileUploadAuthorization>("/files/upload-authorization", {
    purpose,
    organizationId,
    resourceId,
    ...(challengeId ? { challengeId } : {}),
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    bytes: file.size,
  });

  // The signed URL points at object storage directly (a different origin,
  // with its own signature) — never route this through `apiClient`: no
  // session cookies, no CSRF header, no JSON content-type, and only the
  // exact `requiredHeaders` the signature was computed over are allowed or
  // the storage provider rejects it.
  await axios.put(authorization.uploadUrl, file, {
    headers: authorization.requiredHeaders,
    withCredentials: false,
  });

  return apiPost<PrivateFileAsset>("/files/confirm", {
    organizationId,
    storedObjectId: authorization.storedObjectId,
  });
}

/** React Query mutation wrapper around {@link uploadPrivateFile}. */
export function useUploadPrivateFile() {
  return useMutation({ mutationFn: uploadPrivateFile });
}

export interface PrivateFileDownload {
  downloadUrl: string;
  expiresAt: string;
}

/**
 * Fetches a fresh, short-lived download URL for a confirmed private file.
 * Never persist/cache the resulting URL — it expires quickly (backend
 * default: a few minutes) — always call this again on demand instead.
 *
 * Throws (via the shared axios error shape, `err.code`) with:
 * - `FILE_SCAN_PENDING` while malware scanning hasn't cleared the file yet
 *   (still `QUARANTINED`, or the scan itself failed to complete).
 * - `FILE_QUARANTINED` if the scan found the file infected.
 * Callers should treat both as "try again later" / "re-upload," not as
 * hard failures.
 */
export function requestPrivateFileDownload(fileId: string): Promise<PrivateFileDownload> {
  return apiGet<PrivateFileDownload>(`/files/${fileId}/download`);
}

/** React Query mutation wrapper around {@link requestPrivateFileDownload}, meant to be triggered on click (e.g. "Download"). */
export function useRequestPrivateFileDownload() {
  return useMutation({ mutationFn: requestPrivateFileDownload });
}

export function useDeletePrivateFile() {
  return useMutation({ mutationFn: (fileId: string) => apiDelete<void>(`/files/${fileId}`) });
}

// --- Client-side reference persistence -------------------------------------
// Some purposes have no backend field to record which private file a parent
// record is currently pointing at (e.g. a submission's presentation file —
// see the schema note in SubmissionEditorPage.tsx). For those, we persist a
// lightweight, best-effort local reference so the upload survives a page
// reload in the same browser. Purposes whose target already has a place to
// store a durable reference (e.g. a support-ticket comment's markdown body)
// don't need this and should prefer the real backend record instead.

const STORAGE_PREFIX = "devsurge:private-file-ref:";

export interface StoredFileRef {
  fileId: string;
  displayName: string;
}

export function readStoredFileRef(key: string): StoredFileRef | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as StoredFileRef) : null;
  } catch {
    return null;
  }
}

export function writeStoredFileRef(key: string, ref: StoredFileRef | null): void {
  try {
    if (ref === null) localStorage.removeItem(STORAGE_PREFIX + key);
    else localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(ref));
  } catch {
    // Best-effort only (private browsing / storage quota) — the upload
    // still succeeded server-side even if we can't remember it locally.
  }
}
