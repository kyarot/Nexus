import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Hand, MicOff, Sparkles, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { COPILOT_SCENARIOS } from "./mock-data";
import type { CopilotScenario, CopilotVoiceState } from "./types";

type OverlayPhase = "closed" | "opening" | "intro" | "active" | "closing";

const voiceCycle: CopilotVoiceState[] = ["listening", "thinking", "speaking", "idle"];

const levelStyles: Record<CopilotScenario["operations"][number]["level"], string> = {
  normal: "border-l-primary/40",
  high: "border-l-warning",
  critical: "border-l-destructive",
};

function ConfidenceRing({ value }: { value: number }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (circumference * value) / 100;

  return (
    <div className="relative h-20 w-20">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
        <circle cx="40" cy="40" r={radius} className="fill-none stroke-muted" strokeWidth={7} />
        <circle
          cx="40"
          cy="40"
          r={radius}
          className="fill-none stroke-primary transition-all duration-500"
          strokeWidth={7}
          strokeLinecap="round"
          style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-xs font-bold text-primary">{value}%</span>
    </div>
  );
}

function VoiceWave({ state }: { state: CopilotVoiceState }) {
  const isActive = state === "listening" || state === "speaking" || state === "thinking";
  const bars = [22, 34, 48, 32, 54, 36, 26];

  return (
    <div className="flex items-end gap-1.5 px-1">
      {bars.map((height, index) => (
        <motion.div
          key={index}
          className="w-1.5 rounded-full bg-gradient-to-b from-[#B9B3FF] via-[#6B5CFF] to-[#4F46E5] shadow-[0_0_10px_rgba(79,70,229,0.18)]"
          initial={{ height }}
          animate={isActive ? { height: [height * 0.42, height, height * 0.66, height * 0.88] } : { height: height * 0.52 }}
          transition={{ duration: 1.1, repeat: isActive ? Infinity : 0, ease: "easeInOut", delay: index * 0.06 }}
        />
      ))}
    </div>
  );
}

export function NexusCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState<OverlayPhase>("closed");
  const [scenarioId, setScenarioId] = useState(COPILOT_SCENARIOS[0].id);
  const [query, setQuery] = useState(COPILOT_SCENARIOS[0].prompt);
  const [voiceState, setVoiceState] = useState<CopilotVoiceState>("idle");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);
  const [idleSpinTick, setIdleSpinTick] = useState(0);

  const scenario = useMemo(
    () => COPILOT_SCENARIOS.find((item) => item.id === scenarioId) ?? COPILOT_SCENARIOS[0],
    [scenarioId]
  );

  useEffect(() => {
    if (!isOpen) return;

    setPhase("opening");
    const introTimer = window.setTimeout(() => setPhase("intro"), 4200);
    const activeTimer = window.setTimeout(() => setPhase("active"), 8800);

    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(activeTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || phase !== "active" || isProcessing) return;

    const timer = window.setInterval(() => {
      setVoiceState((prev) => {
        const idx = voiceCycle.indexOf(prev);
        return voiceCycle[(idx + 1) % voiceCycle.length];
      });
    }, 3200);

    return () => window.clearInterval(timer);
  }, [isOpen, phase, isProcessing]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    const interval = window.setInterval(() => {
      if (!isTriggerHovered) {
        setIdleSpinTick((current) => current + 1);
      }
    }, 6200 + Math.floor(Math.random() * 2400));

    return () => window.clearInterval(interval);
  }, [isOpen, isTriggerHovered]);

  const runScenario = (next: CopilotScenario) => {
    setIsProcessing(true);
    setVoiceState("thinking");

    window.setTimeout(() => {
      setScenarioId(next.id);
      setQuery(next.prompt);
      setVoiceState("speaking");
    }, 900);

    window.setTimeout(() => {
      setIsProcessing(false);
      setVoiceState("idle");
    }, 2200);
  };

  const openOverlay = () => {
    setIsOpen(true);
  };

  const closeOverlay = () => {
    setPhase("closing");
    setVoiceState("idle");
    window.setTimeout(() => {
      setIsOpen(false);
      setPhase("closed");
      setIsProcessing(false);
    }, 420);
  };

  return (
    <>
      {!isOpen ? (
        <motion.button
          aria-label="Open Nexus Copilot"
          onClick={openOverlay}
          onHoverStart={() => setIsTriggerHovered(true)}
          onHoverEnd={() => setIsTriggerHovered(false)}
          className="fixed bottom-6 right-10 z-[70] grid h-16 w-16 place-items-center rounded-full bg-transparent p-0 shadow-none"
          animate={{ y: [0, -2, 0], scale: [1, 1.01, 1] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.img
            key={isTriggerHovered ? `hover-${idleSpinTick}` : `idle-${idleSpinTick}`}
            src="/logo.png"
            alt="Nexus"
            className="h-16 w-16 rounded-full bg-transparent object-contain"
            initial={{ rotate: 0, scale: 1 }}
            animate={isTriggerHovered ? { rotate: 360, scale: 1.05 } : { rotate: 360, scale: 1 }}
            transition={{ duration: isTriggerHovered ? 1.2 : 1.55, ease: "easeInOut" }}
          />
        </motion.button>
      ) : null}

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
              className="fixed inset-0 z-[80] bg-[#F7F8FF]/68 backdrop-blur-[22px]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-full p-4 lg:p-5"
            >
                <div className="mx-auto h-full max-w-[1520px] rounded-3xl border border-primary/15 bg-white/50 p-4 shadow-[0_24px_80px_rgba(79,70,229,0.14)] lg:p-5">
                <header className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src="/logo.png" alt="Nexus" className="h-9 w-9 bg-transparent object-contain" />
                    <div>
                      <p className="text-base font-bold text-primary">Nexus Copilot</p>
                    </div>
                  </div>
                  <button
                    onClick={closeOverlay}
                    className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                    aria-label="Close copilot overlay"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </header>

                {(phase === "opening" || phase === "intro") ? (
                  <div className="relative flex h-[calc(100%-60px)] items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.16),transparent_42%),radial-gradient(circle_at_center,rgba(124,58,237,0.08),transparent_58%)]" />
                    <motion.div
                      className="absolute h-[26rem] w-[26rem] rounded-full border border-primary/10"
                      initial={{ opacity: 0, scale: 0.72 }}
                      animate={{ opacity: [0.2, 0.55, 0.24], scale: [0.74, 0.98, 1.06] }}
                      transition={{ duration: 3.4, ease: "easeInOut", repeat: Infinity }}
                    />
                    <div className="relative flex flex-col items-center text-center">
                      <div className="mb-5 flex h-[17.5rem] items-center justify-center">
                        <motion.img
                          src="/logo.png"
                          alt="Nexus"
                          className="relative z-10 h-28 w-28 bg-transparent object-contain drop-shadow-[0_22px_70px_rgba(79,70,229,0.3)]"
                          initial={{ opacity: 1, scale: 0.14, rotate: -160, y: 58 }}
                          animate={{
                            opacity: [1, 1, 1, 1, 1, 1],
                            scale: [0.14, 0.32, 0.7, 1.15, 1.7, 2.2],
                            rotate: [-160, -40, 40, 180, 360, 540],
                            y: [58, 32, 16, 6, -4, -10],
                          }}
                          transition={{
                            duration: 6.2,
                            times: [0, 0.08, 0.2, 0.38, 0.58, 0.74],
                            ease: "linear",
                          }}
                        />
                      </div>
                      <motion.h2
                        initial={{ opacity: 0, y: 18, clipPath: "inset(0 100% 0 0)" }}
                        animate={{ opacity: 1, y: 0, clipPath: "inset(0 0% 0 0)" }}
                        transition={{ delay: 4.2, duration: 1.9, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-1 bg-gradient-to-r from-[#3730A3] via-[#4F46E5] to-[#6366F1] bg-clip-text text-3xl font-extrabold text-transparent lg:text-5xl"
                      >
                        Welcome to Nexus AI
                      </motion.h2>
                      <motion.p
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 5.2, duration: 1.1, ease: "easeOut" }}
                        className="max-w-xl text-sm leading-6 text-muted-foreground lg:text-base"
                      >
                        A coordinated intelligence layer for reports, missions, alerts, and action-ready decisions.
                      </motion.p>
                    </div>
                  </div>
                ) : (
                  <div className="grid h-[calc(100%-60px)] grid-cols-1 gap-3 lg:grid-cols-[1.1fr_2fr_1.15fr]">
                    <section className="rounded-2xl border border-primary/15 bg-card/90 p-4 shadow-card">
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Coordinator</p>
                      <div className="rounded-2xl border border-primary/15 bg-background px-3 py-2.5 text-sm text-foreground">{query}</div>

                      <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-primary">Copilot</p>
                      <div className="rounded-2xl gradient-primary px-3 py-3 text-sm leading-relaxed text-primary-foreground">
                        {isProcessing ? "Synthesizing cross-module signals from reports, missions, alerts, and volunteers..." : scenario.narrative}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {scenario.chips.map((chip, index) => {
                          const target = COPILOT_SCENARIOS[(index + 1) % COPILOT_SCENARIOS.length];
                          return (
                            <button
                              key={chip}
                              onClick={() => runScenario(target)}
                              className="rounded-pill border border-primary/20 bg-background px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-light"
                            >
                              {chip}
                            </button>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-primary/15 bg-card/90 p-4 shadow-card">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="text-2xl font-extrabold text-foreground lg:text-4xl">The Analyst</h3>
                          <p className="text-xs text-muted-foreground">Detailed reasoning with action-ready recommendations</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">Confidence score</span>
                          <ConfidenceRing value={scenario.confidence} />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-primary/10 bg-background p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div>
                            <h4 className="text-lg font-bold text-foreground">{scenario.analystTitle}</h4>
                            <p className="text-xs text-muted-foreground">{scenario.analystSubtitle}</p>
                          </div>
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>

                        <div className="flex h-40 items-end gap-1.5">
                          {scenario.chartBars.map((value, index) => (
                            <div key={index} className="flex-1 rounded-t-md bg-primary/15">
                              <motion.div
                                className="w-full rounded-t-md bg-gradient-to-b from-primary-glow to-primary"
                                initial={{ height: 10 }}
                                animate={{ height: `${value}%` }}
                                transition={{ duration: 0.45, delay: index * 0.04 }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-primary/10 bg-background p-4">
                        <p className="mb-7 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Reasoning tree</p>
                        <div className="flex items-center gap-2 text-[11px] font-semibold">
                          <div className="rounded-xl border border-primary/15 bg-card px-3 py-2 text-muted-foreground">Raw Input</div>
                          <div className="h-px flex-1 bg-gradient-to-r from-primary/35 to-transparent" />
                          <div className="rounded-xl border border-primary/15 bg-card px-3 py-2 text-muted-foreground">Semantic Synthesis</div>
                          <div className="h-px flex-1 bg-gradient-to-r from-primary/35 to-transparent" />
                          <div className="rounded-xl gradient-primary px-3 py-2 text-primary-foreground">Inference</div>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-primary/15 bg-card/90 p-4 shadow-card">
                      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Live operations</h3>
                      <div className="space-y-2.5">
                        {scenario.operations.map((item) => (
                          <article key={item.id} className={cn("flex items-center justify-between rounded-xl border border-primary/10 border-l-4 bg-background p-3", levelStyles[item.level])}>
                            <div>
                              <p className="text-sm font-bold text-foreground">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.status}</p>
                            </div>
                            <Link to={item.path} className="text-xs font-semibold text-primary hover:text-primary/80">
                              View in page
                            </Link>
                          </article>
                        ))}
                      </div>

                      <div className="mt-4 rounded-2xl border border-primary/10 bg-background p-3">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Suggested volunteers</p>
                        <div className="space-y-2">
                          {scenario.volunteers.map((volunteer) => (
                            <div key={volunteer.name} className="flex items-center gap-2.5 rounded-xl border border-primary/10 bg-card p-2.5">
                              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                                {volunteer.name.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{volunteer.name}</p>
                                <p className="truncate text-[11px] text-muted-foreground">{volunteer.role} • {volunteer.score.toFixed(1)}★</p>
                              </div>
                              <button className="rounded-full border border-primary/20 px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-light">+</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>
                  </div>
                )}

                {phase === "active" ? (
                  <div className="pointer-events-none fixed bottom-4 left-1/2 z-[95] -translate-x-1/2">
                    <div className="pointer-events-auto mx-auto inline-flex h-[72px] items-center gap-3 rounded-[999px] border border-primary/20 bg-white/88 px-3 shadow-[0_14px_42px_rgba(79,70,229,0.16)] backdrop-blur-md">
                      <button
                        onClick={() => setVoiceState("listening")}
                        className="grid h-[52px] w-[52px] place-items-center rounded-full bg-transparent text-white transition-transform hover:scale-[1.02]"
                        aria-label="Activate listening"
                      >
                        <img src="/logo.png" alt="Nexus" className="h-9 w-9 bg-transparent object-contain" />
                      </button>

                      <div className="flex h-10 items-center self-center rounded-xl px-1 leading-none">
                        <VoiceWave state={voiceState} />
                      </div>

                      <Button
                        size="lg"
                        variant="secondary"
                        className="h-[46px] min-w-[148px] rounded-pill bg-white text-[#1E1B4B] shadow-[0_0_0_1px_rgba(79,70,229,0.08)] hover:bg-white/95"
                        onClick={() => setVoiceState("idle")}
                      >
                        <MicOff className="h-5 w-5" />
                        Mute
                      </Button>

                      <Button
                        size="lg"
                        variant="secondary"
                        className="h-[46px] min-w-[176px] rounded-pill border border-destructive/20 bg-[#FDEDEE] text-destructive shadow-none hover:bg-[#FDE3E4]"
                        onClick={() => setVoiceState("thinking")}
                      >
                        <Hand className="h-5 w-5" />
                        Interrupt
                      </Button>

                      <button
                        onClick={() => setVoiceState("speaking")}
                        className="grid h-[46px] w-[46px] place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
                        aria-label="Set speaking state"
                      >
                        <Volume2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
