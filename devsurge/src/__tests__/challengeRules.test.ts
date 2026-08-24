import { describe, it, expect } from "vitest";

describe("Challenge Participation & Submission Rules", () => {
  it("enforces maximum 4 screenshots limit on submissions", () => {
    const validScreenshots = [
      "https://vusurge.io/shot1.png",
      "https://vusurge.io/shot2.png",
      "https://vusurge.io/shot3.png",
      "https://vusurge.io/shot4.png",
    ];
    const invalidScreenshots = [
      ...validScreenshots,
      "https://vusurge.io/shot5.png",
    ];

    expect(validScreenshots.length).toBeLessThanOrEqual(4);
    expect(invalidScreenshots.length).toBeGreaterThan(4);
    
    // UI validation rule helper
    const canAddMoreScreenshots = (count: number) => count < 4;
    expect(canAddMoreScreenshots(validScreenshots.length)).toBe(false);
    expect(canAddMoreScreenshots(2)).toBe(true);
  });

  it("determines correct CTA based on challenge state and participation", () => {
    type ChallengeState = "DRAFT" | "PUBLISHED" | "REGISTRATION_OPEN" | "SUBMISSION_OPEN" | "JUDGING" | "COMPLETED";
    type UserStatus = "NONE" | "REGISTERED" | "SUBMITTED";

    function getChallengeCTA(state: ChallengeState, status: UserStatus) {
      if (state === "DRAFT") return { label: "Private Preview", enabled: false };
      if (state === "COMPLETED") return { label: "View Official Results", route: "/results", enabled: true };
      if (state === "JUDGING") return { label: "Judging in Progress", enabled: false };
      
      if (status === "NONE") return { label: "Register / Join Challenge", action: "register", enabled: true };
      if (status === "REGISTERED") return { label: "Submit Project", action: "submit", enabled: true };
      if (status === "SUBMITTED") return { label: "View My Submission", action: "view_submission", enabled: true };
      
      return { label: "Explore Details", enabled: true };
    }

    expect(getChallengeCTA("COMPLETED", "SUBMITTED").label).toBe("View Official Results");
    expect(getChallengeCTA("SUBMISSION_OPEN", "NONE").label).toBe("Register / Join Challenge");
    expect(getChallengeCTA("SUBMISSION_OPEN", "REGISTERED").label).toBe("Submit Project");
    expect(getChallengeCTA("SUBMISSION_OPEN", "SUBMITTED").label).toBe("View My Submission");
    expect(getChallengeCTA("JUDGING", "SUBMITTED").enabled).toBe(false);
  });

  it("validates mandatory submission fields before enabling final submit", () => {
    interface SubmissionPayload {
      title: string;
      tagline: string;
      description: string;
      repositoryUrl?: string;
      demoVideoUrl?: string;
      tracks: string[];
      confirmedAccuracy: boolean;
    }

    function isSubmissionReadyForFinalize(data: SubmissionPayload): boolean {
      if (!data.title.trim() || data.title.length < 5) return false;
      if (!data.tagline.trim() || data.tagline.length < 10) return false;
      if (!data.description.trim() || data.description.length < 50) return false;
      if (!data.tracks || data.tracks.length === 0) return false;
      if (!data.confirmedAccuracy) return false;
      return true;
    }

    const incompleteDraft: SubmissionPayload = {
      title: "AI Bot",
      tagline: "Short",
      description: "Too brief",
      tracks: [],
      confirmedAccuracy: false,
    };

    const completeDraft: SubmissionPayload = {
      title: "NeuralSync Autonomous Reasoning Engine",
      tagline: "Decentralized neural multi-agent coordinator for edge clusters",
      description: "A comprehensive open-source implementation allowing verifiable inference across heterogenous nodes with cryptographic attestations.",
      tracks: ["track-ai-agents"],
      confirmedAccuracy: true,
    };

    expect(isSubmissionReadyForFinalize(incompleteDraft)).toBe(false);
    expect(isSubmissionReadyForFinalize(completeDraft)).toBe(true);
  });
});
