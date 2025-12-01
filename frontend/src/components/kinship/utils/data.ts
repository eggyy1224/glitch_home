export const onlyOffspring = (arr: Array<string | null | undefined> | null | undefined): string[] =>
  (arr || []).filter((name): name is string => typeof name === "string" && name.startsWith("offspring_"));

export const levelsOnlyOffspring = (levels: Array<Array<string | null | undefined> | null> | null | undefined): string[][] =>
  (levels || []).map((level) => onlyOffspring(level || []));
