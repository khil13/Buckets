/** Formats American odds with an explicit sign, e.g. 150 -> "+150", -150 -> "-150". */
export function formatAmericanOdds(price: number): string {
  return price > 0 ? `+${price}` : `${price}`;
}

/** Formats a spread/total line, e.g. -3.5 -> "-3.5", 7 -> "+7". */
export function formatLine(line: number): string {
  return line > 0 ? `+${line}` : `${line}`;
}

export function formatTipTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatGameDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatPercent(fraction: number, digits = 0): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

const PROP_STAT_LABELS: Record<string, string> = {
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
  three_pointers_made: "3PT Made",
  points_assists: "Pts+Ast",
  points_rebounds: "Pts+Reb",
  rebounds_assists: "Reb+Ast",
  points_rebounds_assists: "Pts+Reb+Ast",
  double_double: "Double-Double",
  triple_double: "Triple-Double",
};

export function formatPropStat(stat: string): string {
  return PROP_STAT_LABELS[stat] ?? stat;
}
