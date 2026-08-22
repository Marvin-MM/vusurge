import { describe, it, expect } from "vitest";

describe("Organization Governance & Membership Policies", () => {
  type JoinPolicy = "OPEN" | "INVITE_ONLY" | "APPLICATION_REQUIRED" | "DOMAIN_MATCH";
  type Visibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

  interface OrganizationMeta {
    id: string;
    visibility: Visibility;
    joinPolicy: JoinPolicy;
    allowedDomains?: string[];
  }

  function canUserDirectlyJoin(org: OrganizationMeta, userEmail: string): boolean {
    if (org.joinPolicy === "OPEN") return true;
    if (org.joinPolicy === "DOMAIN_MATCH" && org.allowedDomains?.length) {
      const emailDomain = userEmail.split("@")[1];
      return org.allowedDomains.includes(emailDomain);
    }
    return false;
  }

  it("evaluates direct join eligibility based on organization join policy", () => {
    const openOrg: OrganizationMeta = {
      id: "org-open",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
    };

    const domainOrg: OrganizationMeta = {
      id: "org-apex",
      visibility: "PUBLIC",
      joinPolicy: "DOMAIN_MATCH",
      allowedDomains: ["apexlabs.io", "apexresearch.org"],
    };

    const inviteOnlyOrg: OrganizationMeta = {
      id: "org-stealth",
      visibility: "PRIVATE",
      joinPolicy: "INVITE_ONLY",
    };

    expect(canUserDirectlyJoin(openOrg, "user@anydomain.com")).toBe(true);
    expect(canUserDirectlyJoin(domainOrg, "alex@apexlabs.io")).toBe(true);
    expect(canUserDirectlyJoin(domainOrg, "external@gmail.com")).toBe(false);
    expect(canUserDirectlyJoin(inviteOnlyOrg, "anyone@stealth.com")).toBe(false);
  });

  it("protects the final Organization Owner from demotion or self-removal", () => {
    interface Member {
      userId: string;
      role: "ORG_OWNER" | "ORG_ADMIN" | "CHALLENGE_MANAGER" | "MEMBER";
    }

    function canRemoveOrDemoteMember(members: Member[], targetUserId: string): { allowed: boolean; reason?: string } {
      const target = members.find((m) => m.userId === targetUserId);
      if (!target) return { allowed: false, reason: "Member not found" };

      if (target.role === "ORG_OWNER") {
        const ownerCount = members.filter((m) => m.role === "ORG_OWNER").length;
        if (ownerCount <= 1) {
          return {
            allowed: false,
            reason: "Cannot remove or demote the sole organization owner. Transfer ownership first.",
          };
        }
      }
      return { allowed: true };
    }

    const soleOwnerList: Member[] = [
      { userId: "u-alex-owner", role: "ORG_OWNER" },
      { userId: "u-taylor-admin", role: "ORG_ADMIN" },
      { userId: "u-sarah-mgr", role: "CHALLENGE_MANAGER" },
    ];

    const dualOwnerList: Member[] = [
      { userId: "u-alex-owner", role: "ORG_OWNER" },
      { userId: "u-co-owner", role: "ORG_OWNER" },
      { userId: "u-taylor-admin", role: "ORG_ADMIN" },
    ];

    expect(canRemoveOrDemoteMember(soleOwnerList, "u-alex-owner").allowed).toBe(false);
    expect(canRemoveOrDemoteMember(soleOwnerList, "u-taylor-admin").allowed).toBe(true);
    expect(canRemoveOrDemoteMember(dualOwnerList, "u-alex-owner").allowed).toBe(true);
  });
});
