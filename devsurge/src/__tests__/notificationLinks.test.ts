import { describe, expect, test } from "vitest";
import { resolveNotificationRoute } from "@/features/notifications/lib/notificationLink";

describe("notification route integration", () => {
  test("keeps actionable invitation tokens on real frontend routes", () => {
    expect(resolveNotificationRoute("/invitations/org-token")).toEqual({ path: "/invitations/org-token" });
    expect(resolveNotificationRoute("/team-invitations/team-token/accept")).toEqual({
      path: "/team-invitations/team-token/accept",
    });
    expect(resolveNotificationRoute("/challenge-staff-invitations/staff-token/accept")).toEqual({
      path: "/challenge-staff-invitations/staff-token/accept",
    });
  });

  test("maps current and legacy support links without producing an API URL", () => {
    expect(resolveNotificationRoute("/app/support/ticket-id")).toEqual({ path: "/app/support/ticket-id" });
    expect(resolveNotificationRoute("/support/tickets/ticket-id")).toEqual({ path: "/app/support/ticket-id" });
  });

  test("sends judge assignments to the mounted judge portal", () => {
    expect(resolveNotificationRoute("/judge")).toEqual({ path: "/judge" });
  });

  test("keeps participant challenge and result destinations actionable", () => {
    expect(resolveNotificationRoute("/app/my-challenges")).toEqual({ path: "/app/my-challenges" });
    expect(resolveNotificationRoute("/app/results")).toEqual({ path: "/app/results" });
  });
});
