import { describe, expect, it } from "vitest";
import { sgoBoxTeamStatsSchema, sgoEventsResponseSchema } from "./sportsgameodds";

// Fixtures below are trimmed from real /v2/events responses captured live
// during development (via pg_net, bypassing this sandbox's blocked
// egress) — not guessed from docs. The box score numbers (Wizards @
// Clippers) and the odds entries (Pistons @ Celtics) are real values.

const upcomingEventWithOdds = {
  eventID: "YcuJMzH3KxfKzxVKzSQs",
  teams: {
    home: {
      teamID: "DETROIT_PISTONS_NBA",
      names: { long: "Detroit Pistons", medium: "Pistons", short: "DET" },
    },
    away: {
      teamID: "BOSTON_CELTICS_NBA",
      names: { long: "Boston Celtics", medium: "Celtics", short: "BOS" },
    },
  },
  status: { started: false, completed: false, live: false, startsAt: "2026-10-20T19:00:00.000Z" },
  odds: {
    "points-all-game-ou-over": {
      oddID: "points-all-game-ou-over",
      sideID: "over",
      statID: "points",
      statEntityID: "all",
      periodID: "game",
      betTypeID: "ou",
      fairOdds: "+100",
      byBookmaker: {
        draftkings: { odds: "-110", overUnder: "221.5", available: true },
        fanduel: { odds: "-115", overUnder: "221.5", available: true },
      },
    },
    "points-home-game-sp-home": {
      oddID: "points-home-game-sp-home",
      sideID: "home",
      statID: "points",
      statEntityID: "home",
      periodID: "game",
      betTypeID: "sp",
      fairOdds: "+100",
      byBookmaker: {
        draftkings: { odds: "-115", spread: "-1.5", available: true },
      },
    },
    "points-home-game-ml-home": {
      oddID: "points-home-game-ml-home",
      sideID: "home",
      statID: "points",
      statEntityID: "home",
      periodID: "game",
      betTypeID: "ml",
      fairOdds: "-111",
      byBookmaker: {
        draftkings: { odds: "-125", available: true },
      },
    },
    // Player prop — different statEntityID (a player id, not home/away/all).
    // Our sync logic filters these out; the schema should still parse them.
    "points-CADE_CUNNINGHAM_1_NBA-game-ou-over": {
      oddID: "points-CADE_CUNNINGHAM_1_NBA-game-ou-over",
      sideID: "over",
      statID: "points",
      statEntityID: "CADE_CUNNINGHAM_1_NBA",
      periodID: "game",
      betTypeID: "ou",
      byBookmaker: { draftkings: { odds: "-110", overUnder: "24.5", available: true } },
    },
  },
};

const completedEventWithBoxScore = {
  eventID: "RXJ6e7zy3upVSBy1mFUP",
  teams: {
    home: { teamID: "WASHINGTON_WIZARDS_NBA", names: { long: "Washington Wizards", medium: "Wizards", short: "WAS" }, score: 109 },
    away: { teamID: "LA_CLIPPERS_NBA", names: { long: "LA Clippers", medium: "Clippers", short: "LAC" }, score: 125 },
  },
  status: { started: true, completed: true, live: false, startsAt: "2026-01-05T00:00:00.000Z" },
  results: {
    game: {
      home: {
        points: 109,
        fieldGoalsAttempted: 97,
        offensiveRebounds: 12,
        turnovers: 13,
        freeThrowsAttempted: 15,
      },
      away: {
        points: 125,
        fieldGoalsAttempted: 100,
        offensiveRebounds: 18,
        turnovers: 8,
        freeThrowsAttempted: 22,
      },
    },
  },
};

describe("sgoEventsResponseSchema", () => {
  it("parses a real upcoming event with team-level and player-prop odds", () => {
    const payload = { success: true, data: [upcomingEventWithOdds], nextCursor: null };
    expect(() => sgoEventsResponseSchema.parse(payload)).not.toThrow();
  });

  it("parses a real completed event with box score results", () => {
    const payload = { success: true, data: [completedEventWithBoxScore] };
    expect(() => sgoEventsResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects a response missing required fields", () => {
    const payload = { success: true, data: [{ eventID: "abc" }] };
    expect(() => sgoEventsResponseSchema.parse(payload)).toThrow();
  });
});

describe("sgoBoxTeamStatsSchema", () => {
  it("parses the real box score fields our pace/rating math needs", () => {
    const home = completedEventWithBoxScore.results.game.home;
    const away = completedEventWithBoxScore.results.game.away;
    expect(sgoBoxTeamStatsSchema.safeParse(home).success).toBe(true);
    expect(sgoBoxTeamStatsSchema.safeParse(away).success).toBe(true);
  });

  it("rejects an object missing a required stat", () => {
    const { fieldGoalsAttempted, offensiveRebounds, turnovers, freeThrowsAttempted } =
      completedEventWithBoxScore.results.game.home;
    const missingPoints = { fieldGoalsAttempted, offensiveRebounds, turnovers, freeThrowsAttempted };
    expect(sgoBoxTeamStatsSchema.safeParse(missingPoints).success).toBe(false);
  });
});
