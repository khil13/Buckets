import { describe, expect, it } from "vitest";
import { bdlGamesResponseSchema } from "./balldontlie";
import { oddsEventsResponseSchema } from "./oddsapi";

const sampleTeam = {
  id: 2,
  abbreviation: "BOS",
  city: "Boston",
  conference: "East",
  division: "Atlantic",
  full_name: "Boston Celtics",
  name: "Celtics",
};

describe("bdlGamesResponseSchema", () => {
  it("parses a realistic balldontlie /games response", () => {
    const payload = {
      data: [
        {
          id: 15908760,
          date: "2025-01-10T00:00:00.000Z",
          season: 2024,
          status: "Final",
          postseason: false,
          home_team_score: 110,
          visitor_team_score: 105,
          home_team: sampleTeam,
          visitor_team: { ...sampleTeam, id: 14, abbreviation: "LAL", full_name: "Los Angeles Lakers" },
        },
      ],
      meta: { next_cursor: null, per_page: 25 },
    };

    expect(() => bdlGamesResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects a malformed response missing required fields", () => {
    const payload = { data: [{ id: 1, date: "2025-01-10" }] };
    expect(() => bdlGamesResponseSchema.parse(payload)).toThrow();
  });
});

describe("oddsEventsResponseSchema", () => {
  it("parses a realistic Odds API response", () => {
    const payload = [
      {
        id: "abc123",
        sport_key: "basketball_nba",
        commence_time: "2025-01-10T00:00:00Z",
        home_team: "Boston Celtics",
        away_team: "Los Angeles Lakers",
        bookmakers: [
          {
            key: "draftkings",
            title: "DraftKings",
            last_update: "2025-01-09T23:00:00Z",
            markets: [
              {
                key: "spreads",
                last_update: "2025-01-09T23:00:00Z",
                outcomes: [
                  { name: "Boston Celtics", price: -110, point: -3.5 },
                  { name: "Los Angeles Lakers", price: -110, point: 3.5 },
                ],
              },
            ],
          },
        ],
      },
    ];

    expect(() => oddsEventsResponseSchema.parse(payload)).not.toThrow();
  });

  it("rejects an event with an unknown market key", () => {
    const payload = [
      {
        id: "abc123",
        sport_key: "basketball_nba",
        commence_time: "2025-01-10T00:00:00Z",
        home_team: "Boston Celtics",
        away_team: "Los Angeles Lakers",
        bookmakers: [
          {
            key: "draftkings",
            title: "DraftKings",
            last_update: "2025-01-09T23:00:00Z",
            markets: [{ key: "player_points", last_update: "2025-01-09T23:00:00Z", outcomes: [] }],
          },
        ],
      },
    ];

    expect(() => oddsEventsResponseSchema.parse(payload)).toThrow();
  });
});
