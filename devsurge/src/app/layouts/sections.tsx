import { useParams } from "react-router-dom";
import {
  Users,
  Mail,
  KeyRound,
  UserCheck,
  BarChart3,
  Download,
  Settings,
  ScrollText,
  Bell,
  LifeBuoy,
  UserCircle,
  FileCheck2,
  Gavel,
  Trophy,
} from "lucide-react";
import { SectionTabsLayout } from "@/components/shared/SectionTabsLayout";

/**
 * Concrete groupings of related pages behind a single nav entry. Each is a
 * pathless route layout (see App.tsx) so every child keeps its own URL and
 * permission guard; these only decide which sibling tabs to offer.
 */

export function OrgAccessSectionLayout() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  return (
    <SectionTabsLayout
      basePath={`/org/${orgId}`}
      tabs={[
        { to: "members", label: "Members", icon: Users, permission: "organization.manage_members" },
        { to: "invitations", label: "Invitations", icon: Mail, permission: "organization.manage_invitations" },
        { to: "join-codes", label: "Join Codes", icon: KeyRound, permission: "organization.manage_join_codes" },
        { to: "join-requests", label: "Join Requests", icon: UserCheck, permission: "organization.review_join_requests" },
      ]}
    />
  );
}

export function OrgInsightsSectionLayout() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  return (
    <SectionTabsLayout
      basePath={`/org/${orgId}`}
      tabs={[
        { to: "analytics", label: "Analytics", icon: BarChart3, permission: "analytics.view_org" },
        { to: "exports", label: "Exports & Archives", icon: Download, permission: "analytics.export_sensitive" },
      ]}
    />
  );
}

export function OrgGovernanceSectionLayout() {
  const { orgId = "" } = useParams<{ orgId: string }>();
  return (
    <SectionTabsLayout
      basePath={`/org/${orgId}`}
      tabs={[
        { to: "settings", label: "Settings", icon: Settings, permission: "organization.manage_settings" },
        { to: "audit", label: "Audit Logs", icon: ScrollText, permission: "organization.view_audit" },
      ]}
    />
  );
}

export function OrgEvaluationSectionLayout() {
  const { orgId = "", challengeId = "" } = useParams<{ orgId: string; challengeId: string }>();
  return (
    <SectionTabsLayout
      basePath={`/org/${orgId}/challenges/${challengeId}`}
      tabs={[
        { to: "submissions", label: "Submissions Pool", icon: FileCheck2, permission: "submission.view_all" },
        { to: "judging", label: "Judging & Rubrics", icon: Gavel, permission: "challenge.manage_judges" },
        { to: "results", label: "Results", icon: Trophy, permission: "challenge.publish_results" },
      ]}
    />
  );
}

export function ParticipantMessagesSectionLayout() {
  return (
    <SectionTabsLayout
      basePath="/app"
      tabs={[
        { to: "inbox", label: "Inbox", icon: Bell },
        { to: "support", label: "Support Desk", icon: LifeBuoy },
      ]}
    />
  );
}

export function ParticipantAccountSectionLayout() {
  return (
    <SectionTabsLayout
      basePath="/app"
      tabs={[
        { to: "profile", label: "Profile & Skills", icon: UserCircle },
        { to: "settings", label: "Account Settings", icon: Settings },
      ]}
    />
  );
}
