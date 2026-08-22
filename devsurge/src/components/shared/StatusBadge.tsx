import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  OrgRole,
  GlobalRole,
  OrgStatus,
  SubmissionStatus,
  ApplicationStatus,
} from "@/types";
import type { DisplayChallengeStatus } from "@/lib/challengeStatus";

export function RoleBadge({
  role,
  className,
}: {
  role?: OrgRole | GlobalRole | string;
  className?: string;
}) {
  switch (role) {
    case "PLATFORM_SUPERADMIN":
      return <Badge variant="purple" className={className}>Platform Superadmin</Badge>;
    case "ORG_OWNER":
      return <Badge variant="default" className={className}>Org Owner</Badge>;
    case "ORG_ADMIN":
      return <Badge variant="info" className={className}>Org Admin</Badge>;
    case "CHALLENGE_MANAGER":
      return <Badge variant="warning" className={className}>Challenge Manager</Badge>;
    case "JUDGE":
      return <Badge variant="purple" className={className}>Judge</Badge>;
    case "MENTOR":
      return <Badge variant="info" className={className}>Mentor</Badge>;
    case "MEMBER":
    default:
      return <Badge variant="secondary" className={className}>Member</Badge>;
  }
}

export function ChallengeStatusBadge({
  status,
  className,
}: {
  /** Pass `getDisplayStatus(challenge)` from src/lib/challengeStatus.ts, not `challenge.status` directly. */
  status: DisplayChallengeStatus;
  className?: string;
}) {
  switch (status) {
    case "OPEN":
      return <Badge variant="success" className={className}>Open</Badge>;
    case "CLOSED":
      return <Badge variant="warning" className={className}>Submissions Closed</Badge>;
    case "JUDGING":
      return <Badge variant="purple" className={className}>Judging</Badge>;
    case "RESULTS_READY":
      return <Badge variant="info" className={className}>Results Ready</Badge>;
    case "RESULTS_PUBLISHED":
      return <Badge variant="success" className={className}>Results Published</Badge>;
    case "SCHEDULED":
      return <Badge variant="secondary" className={className}>Scheduled</Badge>;
    case "ARCHIVED":
      return <Badge variant="secondary" className={className}>Archived</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive" className={className}>Cancelled</Badge>;
    case "DRAFT":
    default:
      return <Badge variant="outline" className={className}>Draft</Badge>;
  }
}

export function OrganizationStatusBadge({
  status,
  className,
}: {
  status: OrgStatus;
  className?: string;
}) {
  switch (status) {
    case "ACTIVE":
      return <Badge variant="success" className={className}>Active</Badge>;
    case "SUSPENDED":
      return <Badge variant="destructive" className={className}>Suspended</Badge>;
    case "ARCHIVED":
    default:
      return <Badge variant="outline" className={className}>Archived</Badge>;
  }
}

export function SubmissionStatusBadge({
  status,
  className,
}: {
  status: SubmissionStatus;
  className?: string;
}) {
  switch (status) {
    case "FINALIZED":
      return <Badge variant="info" className={className}>Finalized</Badge>;
    case "DISQUALIFIED":
      return <Badge variant="destructive" className={className}>Disqualified</Badge>;
    case "DRAFT":
    default:
      return <Badge variant="outline" className={className}>Draft</Badge>;
  }
}

export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="success" className={className}>Approved</Badge>;
    case "PENDING_REVIEW":
      return <Badge variant="warning" className={className}>Pending Review</Badge>;
    case "DRAFT":
      return <Badge variant="secondary" className={className}>Draft</Badge>;
    case "WITHDRAWN":
      return <Badge variant="outline" className={className}>Withdrawn</Badge>;
    case "REJECTED":
    default:
      return <Badge variant="destructive" className={className}>Rejected</Badge>;
  }
}
