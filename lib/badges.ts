import { Badge, BadgeId, UserStats, MODELS, ModelId } from "./types";

const BADGE_DEFS: Badge[] = [
  {
    id: "novice",
    name: "Novice Creator",
    description: "Generated your first video",
    icon: "🥉",
    tier: "bronze",
    earned: false,
  },
  {
    id: "crafter",
    name: "Content Crafter",
    description: "5 high-quality prompts (score > 70)",
    icon: "🥈",
    tier: "silver",
    earned: false,
  },
  {
    id: "alchemist",
    name: "Ad Alchemist",
    description: "15 videos + 3 prompts scoring > 90",
    icon: "🥇",
    tier: "gold",
    earned: false,
  },
  {
    id: "visionary",
    name: "Viral Visionary",
    description: "30 videos + average score > 85",
    icon: "💎",
    tier: "diamond",
    earned: false,
  },
  {
    id: "promptMaster",
    name: "Prompt Master",
    description: "5 consecutive prompts scoring > 95",
    icon: "🎯",
    tier: "special",
    earned: false,
  },
];

export function getBadges(stats: UserStats): Badge[] {
  return BADGE_DEFS.map((badge) => ({
    ...badge,
    earned: isBadgeEarned(badge.id, stats),
  }));
}

function isBadgeEarned(id: BadgeId, stats: UserStats): boolean {
  switch (id) {
    case "novice":
      return stats.totalVideos >= 1;
    case "crafter":
      return stats.highQualityCount >= 5;
    case "alchemist":
      return stats.totalVideos >= 15 && stats.over90Count >= 3;
    case "visionary":
      return stats.totalVideos >= 30 && stats.avgQuality > 85;
    case "promptMaster": {
      const last5 = stats.promptScores.slice(-5);
      return last5.length >= 5 && last5.every((s) => s > 95);
    }
    default:
      return false;
  }
}

export function calculatePromptQuality(input: {
  product: string;
  icp: string;
  productFeatures: string;
  videoSetting: string;
}): number {
  let score = 0;
  const allText =
    `${input.product} ${input.icp} ${input.productFeatures} ${input.videoSetting}`.toLowerCase();
  const totalLength = allText.length;

  // Length score (0-25)
  if (totalLength > 20 && totalLength <= 500) {
    score += Math.min(25, Math.floor(totalLength / 20));
  }

  // Detail keywords (0-30)
  const detailKeywords = [
    "close-up", "bright", "energetic", "authentic", "natural",
    "morning", "evening", "outdoor", "indoor", "casual",
    "professional", "lifestyle", "vibrant", "warm", "cozy",
    "modern", "minimal", "clean", "dynamic", "candid",
  ];
  const foundDetails = detailKeywords.filter((kw) => allText.includes(kw));
  score += Math.min(30, foundDetails.length * 6);

  // Specificity - has ICP details (0-20)
  if (input.icp.length > 10) score += 10;
  if (/\d+/.test(input.icp)) score += 5; // has numbers (age ranges)
  if (input.icp.includes(",") || input.icp.includes("and")) score += 5;

  // Product features detail (0-15)
  const featureCount = input.productFeatures
    .split(/[,;]/)
    .filter((f) => f.trim().length > 2).length;
  score += Math.min(15, featureCount * 5);

  // Video setting specificity (0-10)
  if (input.videoSetting.length > 15) score += 5;
  if (input.videoSetting.split(" ").length > 3) score += 5;

  return Math.min(100, Math.max(0, score));
}

export function calculateXp(
  promptQuality: number,
  videoCount: number,
  model: ModelId
): number {
  const modelDef = MODELS.find((m) => m.id === model);
  const multiplier = modelDef?.xpMultiplier ?? 1.0;
  return Math.round(promptQuality * videoCount * multiplier);
}

export function getLevelFromXp(xp: number): {
  level: number;
  currentXp: number;
  nextLevelXp: number;
} {
  let level = 1;
  let threshold = 100;
  let accumulated = 0;

  while (xp >= accumulated + threshold && level < 10) {
    accumulated += threshold;
    level++;
    threshold *= 2;
  }

  return {
    level,
    currentXp: xp - accumulated,
    nextLevelXp: threshold,
  };
}

const STATS_KEY = "ugc-user-stats";

export function loadStats(): UserStats {
  if (typeof window === "undefined") {
    return defaultStats();
  }
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultStats();
}

export function saveStats(stats: UserStats): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function defaultStats(): UserStats {
  return {
    totalVideos: 0,
    highQualityCount: 0,
    over90Count: 0,
    avgQuality: 0,
    streak: 0,
    xp: 0,
    level: 1,
    promptScores: [],
  };
}
