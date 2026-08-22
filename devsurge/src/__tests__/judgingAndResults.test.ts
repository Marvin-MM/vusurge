import { describe, it, expect } from "vitest";

describe("Judging Workflow & Results Privacy", () => {
  interface ScorecardCriterion {
    id: string;
    weight: number; // e.g. 0.25 (25%)
    score: number; // 1 - 10
  }

  function calculateWeightedScore(criteria: ScorecardCriterion[]): number {
    const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return 0;
    const weightedSum = criteria.reduce((sum, c) => sum + (c.score * c.weight), 0);
    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  it("calculates weighted scorecard correctly across multiple rubric criteria", () => {
    const criteria: ScorecardCriterion[] = [
      { id: "crit-innovation", weight: 0.30, score: 9 }, // 2.7
      { id: "crit-technical", weight: 0.30, score: 8 },  // 2.4
      { id: "crit-ux", weight: 0.20, score: 7 },         // 1.4
      { id: "crit-feasibility", weight: 0.20, score: 8 },// 1.6
    ];

    const result = calculateWeightedScore(criteria);
    expect(result).toBe(8.1); // (2.7 + 2.4 + 1.4 + 1.6) / 1.0 = 8.1
  });

  it("strictly prevents public leaderboard exposure during ongoing judging state", () => {
    type ChallengeState = "REGISTRATION" | "SUBMISSION" | "JUDGING" | "FINALIZING" | "COMPLETED";

    function shouldExposeLeaderboardToPublic(state: ChallengeState, isPublished: boolean): boolean {
      if (state === "JUDGING") return false;
      if (state === "FINALIZING") return false;
      if (!isPublished) return false;
      return state === "COMPLETED";
    }

    expect(shouldExposeLeaderboardToPublic("JUDGING", false)).toBe(false);
    expect(shouldExposeLeaderboardToPublic("JUDGING", true)).toBe(false);
    expect(shouldExposeLeaderboardToPublic("FINALIZING", false)).toBe(false);
    expect(shouldExposeLeaderboardToPublic("COMPLETED", false)).toBe(false);
    expect(shouldExposeLeaderboardToPublic("COMPLETED", true)).toBe(true);
  });

  it("validates judge conflict-of-interest declaration", () => {
    interface JudgeAssignment {
      judgeId: string;
      submissionId: string;
      hasConflict: boolean;
      conflictReason?: string;
    }

    function canJudgeEvaluate(assignment: JudgeAssignment): boolean {
      return !assignment.hasConflict;
    }

    const unconflicted: JudgeAssignment = {
      judgeId: "judge-elena",
      submissionId: "sub-8829",
      hasConflict: false,
    };

    const conflicted: JudgeAssignment = {
      judgeId: "judge-elena",
      submissionId: "sub-1010",
      hasConflict: true,
      conflictReason: "Advised founding team in 2024 accelerator.",
    };

    expect(canJudgeEvaluate(unconflicted)).toBe(true);
    expect(canJudgeEvaluate(conflicted)).toBe(false);
  });
});
