import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { apiPost } from "@/api/client/axiosClient";

/**
 * Every public-facing image (avatars, org/sponsor logos, challenge covers,
 * submission/support screenshots) is stored via a direct-to-Cloudinary
 * signed-upload flow — distinct from the private, malware-scanned
 * `files`/`fileUpload.ts` pipeline. See
 * `backend/docs/openapi.json: POST /media/images/upload-authorization`.
 */
export type ImageUploadPurpose =
  | "USER_AVATAR"
  | "ORGANIZATION_LOGO"
  | "CHALLENGE_COVER"
  | "SPONSOR_LOGO"
  | "SUBMISSION_SCREENSHOT"
  | "SUPPORT_TICKET_SCREENSHOT"
  | "PORTFOLIO_EVIDENCE";

interface ImageUploadAuthorization {
  assetId: string;
  uploadUrl: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId: string;
  /** Cloudinary's delivery `type` ('upload' | 'authenticated') — this is signed
   * into `signature` server-side, so it MUST be echoed back verbatim as a form
   * field on the upload POST or Cloudinary rejects with 401 Invalid Signature. */
  type: string;
  expiresAt: string;
}

export interface ConfirmedImageAsset {
  id: string;
  purpose: ImageUploadPurpose;
  status: "PENDING" | "CONFIRMED" | "PENDING_DELETION" | "DELETED";
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export interface UploadImageInput {
  purpose: ImageUploadPurpose;
  /** Required for org-scoped purposes (logo, cover, sponsor logo, screenshots tied to a challenge/org). */
  organizationId?: string;
  challengeId?: string;
  /** Required for SPONSOR_LOGO, SUBMISSION_SCREENSHOT, and PORTFOLIO_EVIDENCE (the sponsor id / submission id / innovation id) — rejected by the backend for every other purpose. */
  resourceId?: string;
  file: File;
}

/**
 * The 3-step Cloudinary direct-upload flow: authorize (server signs the
 * upload) -> upload directly to Cloudinary -> confirm (server verifies and
 * activates the asset). Returns the opaque `assetId` to store on the parent
 * resource (e.g. `Organization.logoAssetId`) — resolve it back to a
 * displayable URL via `useAssetUrl()`, never construct a URL by hand.
 */
export async function uploadImage(input: UploadImageInput): Promise<string> {
  const { purpose, organizationId, challengeId, resourceId, file } = input;

  const auth = await apiPost<ImageUploadAuthorization>("/media/images/upload-authorization", {
    purpose,
    ...(organizationId ? { organizationId } : {}),
    ...(challengeId ? { challengeId } : {}),
    ...(resourceId ? { resourceId } : {}),
    mimeType: file.type || "application/octet-stream",
  });

  // Cloudinary's own signed-upload endpoint — a different origin with its
  // own multipart contract, never routed through the credentialed apiClient.
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", auth.apiKey);
  formData.append("timestamp", String(auth.timestamp));
  formData.append("signature", auth.signature);
  formData.append("folder", auth.folder);
  formData.append("public_id", auth.publicId);
  formData.append("type", auth.type);

  await axios.post(auth.uploadUrl, formData, { withCredentials: false });

  await apiPost<ConfirmedImageAsset>("/media/images/confirm", { assetId: auth.assetId });

  return auth.assetId;
}

export function useUploadImage() {
  return useMutation({ mutationFn: uploadImage });
}
