"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Zap,
  Clock,
  Star,
  Download,
  RotateCcw,
  Film,
  Target,
  Trophy,
  Flame,
  BarChart3,
  Image as ImageIcon,
  Users,
  Package,
  Video,
  Layers,
  CheckCircle2,
  Loader2,
  Play,
  Lock,
  Shield,
  AlertTriangle,
} from "lucide-react";
import type {
  JobInput,
  ModelId,
  Job,
  JobState,
  UserStats,
  Badge,
  ModelOption,
} from "@/lib/types";
import { MODELS } from "@/lib/types";
import { startJob, checkStatus, validatePassword } from "@/lib/api";
import {
  getBadges,
  calculatePromptQuality,
  calculateXp,
  getLevelFromXp,
  loadStats,
  saveStats,
} from "@/lib/badges";

/* ── helpers ─────────────────────────────────────────────── */

const HISTORY_KEY = "ugc-job-history";
const PASSWORD_KEY = "ugc-password";

function loadHistory(): Job[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(jobs: Job[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(jobs.slice(0, 20)));
}

/* ── sub-components ──────────────────────────────────────── */

function ProgressRing({
  progress,
  level,
  size = 140,
}: {
  progress: number;
  level: number;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(59,130,246,0.1)"
          strokeWidth={6}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#ring-grad)"
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
          Level
        </span>
        <span className="text-3xl font-bold text-white tabular-nums">
          {level}
        </span>
      </div>
    </div>
  );
}

function QualityBar({ score }: { score: number }) {
  const color =
    score >= 80
      ? "#10B981"
      : score >= 50
        ? "#3B82F6"
        : score >= 25
          ? "#F59E0B"
          : "#64748B";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="label-text !mb-0">
          <Target size={12} /> Prompt Quality
        </span>
        <span className="text-sm font-mono font-semibold" style={{ color }}>
          {score}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: `linear-gradient(90deg, ${color}88, ${color})`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function ModelCard({
  model,
  selected,
  onClick,
}: {
  model: ModelOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`relative flex-1 rounded-xl p-3.5 text-left transition-all duration-200 border ${
        selected
          ? "border-blue-500/60 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.12)]"
          : "border-slate-700/50 bg-slate-800/30 hover:border-slate-600/60"
      }`}
    >
      {selected && (
        <motion.div
          layoutId="model-glow"
          className="absolute inset-0 rounded-xl border-2 border-blue-500/40"
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-sm text-white">{model.name}</span>
          <span className="text-[10px] font-mono text-blue-400">
            {model.xpMultiplier}x XP
          </span>
        </div>
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              model.speed === "Fast"
                ? "bg-emerald-500/15 text-emerald-400"
                : model.speed === "Balanced"
                  ? "bg-blue-500/15 text-blue-400"
                  : "bg-amber-500/15 text-amber-400"
            }`}
          >
            {model.speed}
          </span>
          <span className="text-amber-400 text-[10px]">
            {"★".repeat(model.quality)}
            {"☆".repeat(5 - model.quality)}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          {model.description}
        </p>
      </div>
    </motion.button>
  );
}

function BadgeSlot({ badge }: { badge: Badge }) {
  const tierColors: Record<string, string> = {
    bronze: "from-amber-700/30 to-amber-900/20 border-amber-700/30",
    silver: "from-slate-300/20 to-slate-500/10 border-slate-400/30",
    gold: "from-yellow-500/20 to-amber-600/10 border-yellow-500/30",
    diamond: "from-cyan-400/20 to-blue-500/10 border-cyan-400/30",
    special: "from-purple-500/20 to-pink-500/10 border-purple-400/30",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.08 }}
      className={`relative flex flex-col items-center justify-center rounded-lg p-2.5 border bg-gradient-to-b transition-all ${
        badge.earned
          ? tierColors[badge.tier]
          : "from-slate-800/40 to-slate-900/30 border-slate-700/20 opacity-30"
      }`}
    >
      <span className="text-xl mb-0.5">{badge.icon}</span>
      <span className="text-[9px] text-center text-slate-300 leading-tight font-medium">
        {badge.name}
      </span>
    </motion.div>
  );
}

function Confetti() {
  const [height, setHeight] = useState(800);
  useEffect(() => setHeight(window.innerHeight), []);

  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    size: 4 + Math.random() * 6,
    color: ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899"][
      Math.floor(Math.random() * 5)
    ],
    drift: (Math.random() - 0.5) * 200,
  }));

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            left: `${p.x}%`,
            top: -10,
            width: p.size,
            height: p.size,
            background: p.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: height + 20,
            opacity: 0,
            rotate: 360 + Math.random() * 360,
            x: p.drift,
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: p.delay,
            ease: "easeIn",
          }}
        />
      ))}
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */

export default function Home() {
  const [password, setPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [remaining, setRemaining] = useState(2);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [form, setForm] = useState<JobInput>({
    product: "",
    productPhotoUrl: "",
    icp: "",
    productFeatures: "",
    videoSetting: "",
    model: "Veo 3.1",
  });
  const [jobState, setJobState] = useState<JobState>("idle");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats>({
    totalVideos: 0,
    highQualityCount: 0,
    over90Count: 0,
    avgQuality: 0,
    streak: 0,
    xp: 0,
    level: 1,
    promptScores: [],
  });
  const [history, setHistory] = useState<Job[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted data on mount
  useEffect(() => {
    setStats(loadStats());
    setHistory(loadHistory());
    const savedPw = localStorage.getItem(PASSWORD_KEY);
    if (savedPw) {
      validatePassword(savedPw)
        .then((res) => {
          setPassword(savedPw);
          setAuthenticated(true);
          setIsAdmin(res.isAdmin);
          if (typeof res.remaining === "number" && res.remaining >= 0) {
            setRemaining(res.remaining);
          }
        })
        .catch(() => {
          localStorage.removeItem(PASSWORD_KEY);
        });
    }
  }, []);

  const promptScore = calculatePromptQuality({
    product: form.product,
    icp: form.icp,
    productFeatures: form.productFeatures,
    videoSetting: form.videoSetting,
  });

  const levelInfo = getLevelFromXp(stats.xp);
  const badges = getBadges(stats);
  const xpPercent =
    levelInfo.nextLevelXp > 0
      ? Math.round((levelInfo.currentXp / levelInfo.nextLevelXp) * 100)
      : 0;

  /* polling */
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string, input: JobInput, quality: number) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await checkStatus(jobId);
          if (res.status === "Finished" && res.videoUrl) {
            stopPolling();
            setJobState("completed");
            setVideoUrl(res.videoUrl);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);

            setStats((prev) => {
              const newScores = [...prev.promptScores, quality];
              const totalVideos = prev.totalVideos + 1;
              const highQualityCount =
                prev.highQualityCount + (quality > 70 ? 1 : 0);
              const over90Count = prev.over90Count + (quality > 90 ? 1 : 0);
              const avgQuality = Math.round(
                newScores.reduce((a, b) => a + b, 0) / newScores.length
              );
              const xp = prev.xp + calculateXp(quality, 1, input.model);
              const updated: UserStats = {
                totalVideos,
                highQualityCount,
                over90Count,
                avgQuality,
                streak: prev.streak + 1,
                xp,
                level: getLevelFromXp(xp).level,
                promptScores: newScores,
              };
              saveStats(updated);
              return updated;
            });

            setHistory((prev) => {
              const updated: Job[] = [
                {
                  id: jobId,
                  input,
                  state: "completed",
                  videoUrl: res.videoUrl,
                  createdAt: Date.now(),
                  completedAt: Date.now(),
                },
                ...prev,
              ];
              saveHistory(updated);
              return updated;
            });
          }
        } catch {
          /* keep polling on transient errors */
        }
      }, 5000);
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  /* password gate */
  const handlePasswordSubmit = async () => {
    if (!passwordInput.trim()) return;
    try {
      const res = await validatePassword(passwordInput);
      setPassword(passwordInput);
      setAuthenticated(true);
      setPasswordError(null);
      setIsAdmin(res.isAdmin);
      if (typeof res.remaining === "number" && res.remaining >= 0) {
        setRemaining(res.remaining);
      }
      localStorage.setItem(PASSWORD_KEY, passwordInput);
    } catch (err) {
      setPasswordError(
        err instanceof Error ? err.message : "Invalid password"
      );
    }
  };

  /* form submit */
  const handleSubmit = async () => {
    if (!form.product.trim()) return;
    setError(null);
    setJobState("submitting");

    try {
      const res = await startJob(form, password);
      if (res.isAdmin) {
        setIsAdmin(true);
      }
      if (typeof res.remaining === "number" && res.remaining >= 0) {
        setRemaining(res.remaining);
      }
      setCurrentJobId(res.jobId);
      setJobState("processing");
      startPolling(res.jobId, form, promptScore);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      if (msg.includes("Wrong password")) {
        setAuthenticated(false);
        setPassword("");
        setPasswordInput("");
        localStorage.removeItem(PASSWORD_KEY);
        setPasswordError("Wrong password. Please try again.");
        setJobState("idle");
      } else {
        setError(msg);
        setJobState("failed");
      }
    }
  };

  const handleReset = () => {
    stopPolling();
    setJobState("idle");
    setVideoUrl(null);
    setCurrentJobId(null);
    setError(null);
    setForm({
      product: "",
      productPhotoUrl: "",
      icp: "",
      productFeatures: "",
      videoSetting: "",
      model: "Veo 3.1",
    });
  };

  const canSubmit =
    jobState === "idle" &&
    form.product.trim() !== "" &&
    form.productPhotoUrl.trim() !== "" &&
    (isAdmin || remaining > 0);

  const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  };
  const fadeUp = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  };

  /* ── password gate ── */
  if (!authenticated) {
    return (
      <>
        <div className="scan-lines" />
        <div className="min-h-screen bg-[#0A1628] text-slate-200 selection:bg-blue-500/30 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="glass-card rounded-2xl p-8 w-full max-w-md space-y-6"
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                <Lock size={24} className="text-white" />
              </div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                UGC Ads Generator
              </h1>
              <p className="text-sm text-slate-400 leading-relaxed">
                Enter the password to access the app.
                <br />
                <span className="text-slate-500 text-xs">
                  You will receive <span className="text-blue-400 font-semibold">2 free requests</span> to generate ads.
                </span>
              </p>
            </div>

            {passwordError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 flex items-center gap-2"
              >
                <AlertTriangle size={14} />
                {passwordError}
              </motion.div>
            )}

            <div className="space-y-3">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePasswordSubmit()}
                placeholder="Enter password..."
                className="field w-full"
                autoFocus
              />
              <motion.button
                onClick={handlePasswordSubmit}
                disabled={!passwordInput.trim()}
                whileHover={passwordInput.trim() ? { scale: 1.01 } : {}}
                whileTap={passwordInput.trim() ? { scale: 0.98 } : {}}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                  passwordInput.trim()
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.25)] hover:shadow-[0_0_40px_rgba(59,130,246,0.35)] cursor-pointer"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                <Shield size={16} />
                Unlock Access
              </motion.button>
            </div>
          </motion.div>
        </div>
      </>
    );
  }

  return (
    <>
      {showConfetti && <Confetti />}
      <div className="scan-lines" />

      <div className="min-h-screen bg-[#0A1628] text-slate-200 selection:bg-blue-500/30">
        {/* ── HEADER ── */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="border-b border-slate-700/40 bg-[#0A1628]/80 backdrop-blur-xl sticky top-0 z-40"
        >
          <div className="max-w-[1440px] mx-auto flex items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                <Film size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white">
                  UGC Ads Generator
                </h1>
                <p className="text-[10px] text-slate-500 tracking-wide uppercase">
                  Veo &bull; NanoBanana &bull; Sora
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${
                    jobState === "processing"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-emerald-400"
                  }`}
                />
                {jobState === "processing" ? "Processing" : "Online"}
              </div>
              <div className="h-4 w-px bg-slate-700/60" />
              {!isAdmin && (
                <div
                  className={`text-xs font-mono px-2 py-1 rounded-md ${
                    remaining === 0
                      ? "bg-red-500/15 text-red-400"
                      : remaining === 1
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-blue-500/10 text-blue-400"
                  }`}
                >
                  {remaining}/{2} requests left
                </div>
              )}
              {isAdmin && (
                <div className="text-xs font-mono px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
                  <Shield size={10} /> Admin
                </div>
              )}
              <div className="h-4 w-px bg-slate-700/60" />
              <div className="text-xs font-mono text-slate-400">
                LVL{" "}
                <span className="text-white font-bold">{stats.level}</span>{" "}
                &bull;{" "}
                <span className="text-blue-400">
                  {stats.xp.toLocaleString()} XP
                </span>
              </div>
            </div>
          </div>
        </motion.header>

        {/* ── CONTENT ── */}
        <motion.main
          variants={stagger}
          initial="hidden"
          animate="show"
          className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 p-6"
        >
          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">
            {/* Form */}
            <AnimatePresence mode="wait">
              {(jobState === "idle" || jobState === "failed" || jobState === "submitting") && (
                <motion.div
                  key="form"
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, y: -12, transition: { duration: 0.3 } }}
                  className="glass-card rounded-2xl p-6 space-y-5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles size={16} className="text-blue-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                      Create Your Ad
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="block">
                      <span className="label-text">
                        <Package size={11} /> Product Name
                      </span>
                      <input
                        type="text"
                        value={form.product}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, product: e.target.value }))
                        }
                        placeholder="e.g. Organic Energy Drink"
                        className="field"
                      />
                    </label>
                    <label className="block">
                      <span className="label-text">
                        <ImageIcon size={11} /> Product Photo URL
                      </span>
                      <input
                        type="url"
                        value={form.productPhotoUrl}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            productPhotoUrl: e.target.value,
                          }))
                        }
                        placeholder="https://..."
                        className="field"
                      />
                    </label>
                    <label className="block">
                      <span className="label-text">
                        <Users size={11} /> Target Audience
                      </span>
                      <input
                        type="text"
                        value={form.icp}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, icp: e.target.value }))
                        }
                        placeholder="e.g. Gym-goers aged 25-40"
                        className="field"
                      />
                    </label>
                    <label className="block">
                      <span className="label-text">
                        <Video size={11} /> Video Setting
                      </span>
                      <input
                        type="text"
                        value={form.videoSetting}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            videoSetting: e.target.value,
                          }))
                        }
                        placeholder="e.g. Bright modern kitchen, morning light"
                        className="field"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="label-text">
                      <Layers size={11} /> Product Features
                    </span>
                    <textarea
                      value={form.productFeatures}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          productFeatures: e.target.value,
                        }))
                      }
                      rows={3}
                      placeholder="e.g. Sugar-free, natural caffeine, refreshing citrus taste, eco-friendly packaging"
                      className="field resize-none"
                    />
                  </label>

                  {/* model selector */}
                  <div>
                    <span className="label-text mb-2 block">
                      <Zap size={11} /> AI Model
                    </span>
                    <div className="flex gap-3">
                      {MODELS.map((m) => (
                        <ModelCard
                          key={m.id}
                          model={m}
                          selected={form.model === m.id}
                          onClick={() =>
                            setForm((f) => ({ ...f, model: m.id }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  <QualityBar score={promptScore} />

                  {!isAdmin && remaining === 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3 flex items-center gap-2"
                    >
                      <AlertTriangle size={14} />
                      You have used all 2 requests. No more generations available.
                    </motion.div>
                  )}

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5"
                    >
                      {error}
                    </motion.div>
                  )}

                  <motion.button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    whileHover={canSubmit ? { scale: 1.01 } : {}}
                    whileTap={canSubmit ? { scale: 0.98 } : {}}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm tracking-wide transition-all duration-300 flex items-center justify-center gap-2 ${
                      canSubmit
                        ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.25)] hover:shadow-[0_0_40px_rgba(59,130,246,0.35)] cursor-pointer"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    {jobState === "submitting" ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} />
                    )}
                    Generate Ad
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Job Status */}
            <AnimatePresence>
              {jobState === "processing" && (
                <motion.div
                  key="status"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="glass-card rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <Loader2
                      size={16}
                      className="text-blue-400 animate-spin"
                    />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                      Generating
                    </h2>
                  </div>

                  <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                    <motion.div
                      className="h-full w-1/3 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                      animate={{ x: ["-100%", "300%"] }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      Processing with{" "}
                      <span className="text-blue-400 font-medium">
                        {form.model}
                      </span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> This may take a few minutes
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="font-mono">
                      JOB #{currentJobId?.slice(-6)}
                    </span>
                    <span>&bull;</span>
                    <span>{form.product}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Video Result */}
            <AnimatePresence>
              {jobState === "completed" && videoUrl && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="glass-card rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                      Your Ad is Ready
                    </h2>
                  </div>

                  <div className="rounded-xl overflow-hidden bg-black/40 border border-slate-700/30">
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      playsInline
                      className="w-full aspect-[9/16] max-h-[500px] object-contain mx-auto"
                    />
                  </div>

                  <div className="flex gap-3">
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600/90 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-500 transition-colors"
                    >
                      <Download size={14} /> Download
                    </a>
                    <button
                      onClick={handleReset}
                      className="flex-1 py-2.5 rounded-xl bg-slate-700/50 text-slate-300 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors"
                    >
                      <RotateCcw size={14} /> New Ad
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {jobState === "failed" && (
              <div className="flex justify-center">
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw size={12} /> Reset &amp; try again
                </button>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <motion.aside variants={fadeUp} className="space-y-5">
            {/* Progress Ring */}
            <div className="glass-card rounded-2xl p-5 flex flex-col items-center text-center">
              <ProgressRing progress={xpPercent} level={levelInfo.level} />
              <div className="mt-3 text-xs text-slate-400">
                <span className="font-mono text-blue-400 font-semibold">
                  {levelInfo.currentXp.toLocaleString()}
                </span>{" "}
                / {levelInfo.nextLevelXp.toLocaleString()} XP
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 uppercase tracking-wider">
                to next level
              </div>
            </div>

            {/* Badges */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={13} className="text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Badges
                </h3>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {badges.map((b) => (
                  <BadgeSlot key={b.id} badge={b} />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={13} className="text-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  Stats
                </h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    label: "Ads Created",
                    value: stats.totalVideos,
                    icon: <Film size={13} className="text-blue-400" />,
                  },
                  {
                    label: "Avg Quality",
                    value: stats.avgQuality || "—",
                    icon: <Star size={13} className="text-amber-400" />,
                  },
                  {
                    label: "Streak",
                    value: stats.streak,
                    icon: <Flame size={13} className="text-orange-400" />,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex flex-col items-center text-center gap-1.5 p-2.5 rounded-lg bg-slate-800/30"
                  >
                    {s.icon}
                    <span className="text-lg font-bold font-mono text-white">
                      {s.value}
                    </span>
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Ads */}
            {history.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Film size={13} className="text-slate-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Recent Ads
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500">
                    {history.length} total
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {history.slice(0, 6).map((job) => (
                    <a
                      key={job.id}
                      href={job.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative aspect-[9/16] rounded-lg bg-slate-800/60 border border-slate-700/30 overflow-hidden hover:border-blue-500/40 transition-colors flex items-center justify-center"
                    >
                      {job.videoUrl ? (
                        <video
                          src={job.videoUrl}
                          muted
                          preload="metadata"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Film size={16} className="text-slate-600" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <Play size={12} className="text-white" fill="white" />
                      </div>
                      <div className="absolute top-1 right-1">
                        <span className="text-[8px] bg-black/50 px-1 py-0.5 rounded text-slate-300 font-mono">
                          {job.input.model.split(" ")[0]}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </motion.aside>
        </motion.main>
      </div>
    </>
  );
}
