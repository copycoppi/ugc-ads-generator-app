export type ModelId = "Nano + Veo 3.1" | "Sora 2";

export interface ModelOption {
  id: ModelId;
  name: string;
  description: string;
  speed: "Fast" | "Balanced" | "Premium";
  quality: number; // 1-5
  xpMultiplier: number;
}

export interface JobInput {
  product: string;
  productPhotoUrl: string;
  icp: string;
  productFeatures: string;
  videoSetting: string;
  model: ModelId;
}

export interface JobStartResponse {
  jobId: string;
  status: "queued";
  message: string;
}

export interface JobStatusResponse {
  jobId: string;
  status: "Ready" | "Finished" | string;
  videoUrl: string;
  product: string;
  model: string;
}

export type JobState = "idle" | "submitting" | "processing" | "completed" | "failed";

export interface Job {
  id: string;
  input: JobInput;
  state: JobState;
  videoUrl?: string;
  createdAt: number;
  completedAt?: number;
}

export type BadgeId =
  | "novice"
  | "crafter"
  | "alchemist"
  | "visionary"
  | "promptMaster";

export interface Badge {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "diamond" | "special";
  earned: boolean;
}

export interface UserStats {
  totalVideos: number;
  highQualityCount: number; // prompts > 70
  over90Count: number; // prompts > 90
  avgQuality: number;
  streak: number;
  xp: number;
  level: number;
  promptScores: number[];
}

export const MODELS: ModelOption[] = [
  {
    id: "Nano + Veo 3.1",
    name: "Nano + Veo",
    description: "NanoBanana image generation + Veo video. Highest quality.",
    speed: "Balanced",
    quality: 5,
    xpMultiplier: 1.2,
  },
  {
    id: "Sora 2",
    name: "Sora 2",
    description: "OpenAI Sora image-to-video. Premium cinematic style.",
    speed: "Premium",
    quality: 5,
    xpMultiplier: 1.5,
  },
];
