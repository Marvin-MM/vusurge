import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/api/client/axiosClient";
import { useCursorList } from "@/lib/useCursorList";
import { ModerationReport, ModerationTargetType, ModerationCategory } from "@/types";

// =============================================================================
// User-facing content reporting (`/reports`, `/reports/mine`) — filing a
// report and viewing your own filing history. The review/action side for
// platform superadmins already lives in features/superadmin/api/queries.ts.
// =============================================================================

/** Reports the signed-in caller has previously filed — `GET /reports/mine`. */
export function useMyReports() {
  return useCursorList<ModerationReport>(["reports", "mine"], "/reports/mine");
}

export interface FileReportInput {
  targetType: ModerationTargetType;
  targetId: string;
  category: ModerationCategory;
  description: string;
}

/** File a new content report against an organization or a public challenge — `POST /reports`. */
export function useFileReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FileReportInput) => apiPost<ModerationReport>("/reports", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports", "mine"] }),
  });
}
