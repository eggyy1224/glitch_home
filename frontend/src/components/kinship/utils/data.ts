export const onlyOffspring = (arr) => (arr || []).filter((name) => typeof name === "string" && name.startsWith("offspring_"));

export const levelsOnlyOffspring = (levels) => (levels || []).map((level) => onlyOffspring(level));
