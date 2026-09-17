export interface RestContext {
  /** Days of rest before this game, or null if no prior game is known. */
  restDays: number | null;
  isBackToBack: boolean;
}

/**
 * Computes rest days / back-to-back status for a game from a team's other
 * game dates. `otherGameDates` should be ISO date strings (YYYY-MM-DD) for
 * every other game the team has played this season; `targetDate` is the
 * game being evaluated.
 */
export function getRestContext(otherGameDates: string[], targetDate: string): RestContext {
  const target = new Date(targetDate).getTime();

  const priorTimes = otherGameDates
    .map((d) => new Date(d).getTime())
    .filter((t) => t < target)
    .sort((a, b) => b - a);

  const previous = priorTimes[0];
  if (previous === undefined) {
    return { restDays: null, isBackToBack: false };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((target - previous) / msPerDay);

  return {
    restDays: Math.max(diffDays - 1, 0),
    isBackToBack: diffDays <= 1,
  };
}
