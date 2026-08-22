import { describe, it, expect } from "vitest";
import { can, Permission } from "@/types/permissions";
import { UserContext, User } from "@/types";

const createMockUser = (overrides: Partial<User>): User => ({
  id: "u-default",
  email: "default@devarena.io",
  fullName: "Default User",
  username: "default_user",
  globalRole: "USER",
  createdAt: "2025-01-01T00:00:00Z",
  twoFactorEnabled: false,
  profile: {
    skills: [],
    availableForTeams: true,
    timezone: "UTC",
  },
  ...overrides,
});

describe("Permission Helpers & Role Security", () => {
  const superadminContext: UserContext = {
    user: createMockUser({ id: "u-1", email: "admin@devarena.internal", fullName: "Marcus Vance", username: "marcus", globalRole: "PLATFORM_SUPERADMIN" }),
    globalRole: "PLATFORM_SUPERADMIN",
  };

  const orgOwnerContext: UserContext = {
    user: createMockUser({ id: "u-2", email: "alex@apexlabs.io", fullName: "Alex Rivera", username: "arivera", globalRole: "USER" }),
    globalRole: "USER",
    activeOrgId: "org-apex-labs",
    orgRole: "ORG_OWNER",
  };

  const orgAdminContext: UserContext = {
    user: createMockUser({ id: "u-3", email: "taylor@apexlabs.io", fullName: "Taylor Brooks", username: "tbrooks", globalRole: "USER" }),
    globalRole: "USER",
    activeOrgId: "org-apex-labs",
    orgRole: "ORG_ADMIN",
  };

  const challengeManagerContext: UserContext = {
    user: createMockUser({ id: "u-4", email: "sarah@apexlabs.io", fullName: "Sarah Chen", username: "schen", globalRole: "USER" }),
    globalRole: "USER",
    activeOrgId: "org-apex-labs",
    orgRole: "CHALLENGE_MANAGER",
  };

  const participantContext: UserContext = {
    user: createMockUser({ id: "u-5", email: "david@buildtech.dev", fullName: "David Kim", username: "dkim", globalRole: "USER" }),
    globalRole: "USER",
    activeOrgId: "org-apex-labs",
    orgRole: "MEMBER",
    challengeRoles: {
      "chal-nextgen-ai": "PARTICIPANT",
    },
  };

  const judgeContext: UserContext = {
    user: createMockUser({ id: "u-6", email: "elena@oxford.edu", fullName: "Elena Rostova", username: "erostova", globalRole: "USER" }),
    globalRole: "USER",
    activeOrgId: "org-apex-labs",
    orgRole: "MEMBER",
    challengeRoles: {
      "chal-nextgen-ai": "JUDGE",
    },
  };

  const unauthenticatedContext = null;

  it("denies all permissions to unauthenticated context", () => {
    expect(can(unauthenticatedContext, "challenge.view")).toBe(false);
    expect(can(unauthenticatedContext, "submission.create")).toBe(false);
    expect(can(unauthenticatedContext, "platform.manage_organizations")).toBe(false);
  });

  it("grants every platform.* permission to PLATFORM_SUPERADMIN, but no ambient org access", () => {
    const platformPermissions: Permission[] = [
      "platform.review_applications",
      "platform.manage_organizations",
      "platform.moderate",
      "platform.support",
      "platform.view_audit",
      "platform.manage_feature_flags",
      "platform.manage_roles",
    ];
    for (const permission of platformPermissions) {
      expect(can(superadminContext, permission)).toBe(true);
    }

    // A superadmin has no organization role by default: reaching into a
    // tenant's data is always a separate, explicit platform.* action, never
    // an ambient "see everything" grant — matches the real backend model.
    expect(can(superadminContext, "organization.archive")).toBe(false);
    expect(can(superadminContext, "challenge.publish")).toBe(false);
    expect(can(superadminContext, "judging.finalize")).toBe(false);
  });

  it("enforces ORG_OWNER vs ORG_ADMIN vs CHALLENGE_MANAGER boundaries", () => {
    // Transfer ownership and archive are exclusive to ORG_OWNER
    expect(can(orgOwnerContext, "organization.transfer_ownership")).toBe(true);
    expect(can(orgOwnerContext, "organization.archive")).toBe(true);
    expect(can(orgAdminContext, "organization.transfer_ownership")).toBe(false);
    expect(can(orgAdminContext, "organization.archive")).toBe(false);

    // Both can manage settings and members
    expect(can(orgOwnerContext, "organization.manage_members")).toBe(true);
    expect(can(orgAdminContext, "organization.manage_members")).toBe(true);

    // CHALLENGE_MANAGER cannot manage org members or integrations
    expect(can(challengeManagerContext, "organization.manage_members")).toBe(false);
    expect(can(challengeManagerContext, "organization.manage_integrations")).toBe(false);
    expect(can(challengeManagerContext, "challenge.create")).toBe(true);
    expect(can(challengeManagerContext, "challenge.manage_rubric")).toBe(true);
  });

  it("scopes challenge-level roles accurately", () => {
    // Participant can submit to assigned challenge
    expect(can(participantContext, "submission.create", "chal-nextgen-ai")).toBe(true);
    expect(can(participantContext, "submission.submit", "chal-nextgen-ai")).toBe(true);
    expect(can(participantContext, "judging.score_assigned", "chal-nextgen-ai")).toBe(false);

    // Judge can score assigned submissions in challenge but not submit
    expect(can(judgeContext, "judging.view_assigned", "chal-nextgen-ai")).toBe(true);
    expect(can(judgeContext, "judging.score_assigned", "chal-nextgen-ai")).toBe(true);
    expect(can(judgeContext, "organization.manage_settings")).toBe(false);
  });
});
