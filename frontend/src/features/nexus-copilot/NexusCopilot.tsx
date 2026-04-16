import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Hand, MicOff, Sparkles, Volume2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CommunityPulseDonut } from "@/components/coordinator/CommunityPulseDonut";
import { EmptyState } from "@/components/coordinator/EmptyState";
import { GeminiInsightCard } from "@/components/coordinator/GeminiInsightCard";
import { MissionsLiveMap } from "@/components/coordinator/MissionsLiveMap";
import { NeedTerrainMap } from "@/components/coordinator/NeedTerrainMap";
import { StatMetricCard } from "@/components/coordinator/StatMetricCard";
import { VolunteerAvatarCard } from "@/components/coordinator/VolunteerAvatarCard";

import type { CopilotQueryResponse, CopilotUiBlock, CopilotVoiceResponse, CopilotVoiceState } from "./types";

type OverlayPhase = "closed" | "opening" | "intro" | "active" | "closing";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
const DEFAULT_SUGGESTIONS: string[] = [];
const VOICE_SILENCE_DELAY_MS = 2200;
const INTERRUPT_COPY = "Uh oh. I got interrupted. Say that again when you're ready.";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    SpeechRecognition?: SpeechRecognitionConstructorLike;
  }
}

function VoiceWave({ state }: { state: CopilotVoiceState }) {
  const isActive = state === "listening" || state === "speaking" || state === "thinking";
  const bars = [22, 34, 48, 32, 54, 36, 26];

  return (
    <div className="flex items-end gap-1.5 px-1">
      {bars.map((height, index) => (
        <motion.div
          key={index}
          className="w-1.5 rounded-full bg-gradient-to-b from-[#B9B3FF] via-[#6B5CFF] to-[#4F46E5]"
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
  const [sessionId, setSessionId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const [voiceState, setVoiceState] = useState<CopilotVoiceState>("idle");
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [responseText, setResponseText] = useState(
    "Ask me for Gemini insights, high-risk zones, or a dashboard summary and I will render live cards from your existing UI."
  );
  const [uiBlocks, setUiBlocks] = useState<CopilotUiBlock[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);

  const authToken = useMemo(() => localStorage.getItem("nexus_access_token") || "", []);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queryAbortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<number | null>(null);
  const transcriptBufferRef = useRef<string>("");
  const shouldAutoListenRef = useRef(false);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopRecognition = () => {
    clearSilenceTimer();
    const recognition = recognitionRef.current;
    if (!recognition) return;

    try {
      recognition.onend = null;
      recognition.stop();
    } catch {
      recognition.abort();
    }
  };

  const maybeRestartRecognition = () => {
    if (!shouldAutoListenRef.current || isMuted || !sessionId || isSessionLoading || isQueryLoading || !isOpen) {
      return;
    }

    const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionImpl) {
      return;
    }

    const recognition = recognitionRef.current || new SpeechRecognitionImpl();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      clearSilenceTimer();

      let finalTranscript = "";
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const phrase = result[0]?.transcript || "";
        if (result.isFinal) {
          finalTranscript += phrase;
        } else {
          interimTranscript += phrase;
        }
      }

      const combinedTranscript = `${transcriptBufferRef.current} ${finalTranscript}`.trim();
      if (combinedTranscript) {
        transcriptBufferRef.current = combinedTranscript;
        setLastQuery(combinedTranscript);
        setQuery(interimTranscript ? `${combinedTranscript} ${interimTranscript}`.trim() : combinedTranscript);
        setVoiceState("listening");
      }

      if (combinedTranscript || interimTranscript) {
        silenceTimerRef.current = window.setTimeout(() => {
          const spokenQuery = transcriptBufferRef.current.trim();
          transcriptBufferRef.current = "";
          setQuery("");
          if (!spokenQuery || isMuted || isQueryLoading) {
            return;
          }

          stopRecognition();
          void submitQuery(spokenQuery);
        }, VOICE_SILENCE_DELAY_MS);
      }
    };

    recognition.onerror = () => {
      clearSilenceTimer();
      setVoiceState(isMuted ? "idle" : "listening");
    };

    recognition.onend = () => {
      clearSilenceTimer();
      if (shouldAutoListenRef.current && !isMuted && !isQueryLoading && isOpen) {
        window.setTimeout(() => {
          try {
            recognition.start();
            setVoiceState("listening");
          } catch {
            // Ignore duplicate-start races.
          }
        }, 180);
      }
    };

    try {
      recognition.start();
      setVoiceState("listening");
    } catch {
      // Ignore duplicate-start races.
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    setPhase("opening");
    const introTimer = window.setTimeout(() => setPhase("intro"), 1600);
    const activeTimer = window.setTimeout(() => setPhase("active"), 3200);

    return () => {
      window.clearTimeout(introTimer);
      window.clearTimeout(activeTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || sessionId || isSessionLoading) return;

    const initSession = async () => {
      try {
        setIsSessionLoading(true);
        setError(null);

        const response = await fetch(`${API_BASE_URL}/copilot/session/start`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
        });

        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.detail || "Failed to initialize copilot session");
        }

        setSessionId(payload.session_id);
        if (payload?.message) {
          setResponseText(String(payload.message));
        }

        if (payload?.audio_base64 && isSpeakerEnabled && !isMuted) {
          stopRecognition();
          setVoiceState("speaking");
          const audio = new Audio(`data:${payload.audio_mime_type || "audio/mpeg"};base64,${payload.audio_base64}`);
          audioRef.current = audio;
          try {
            await audio.play();
          } catch {
            setVoiceState("idle");
          }

          audio.onended = () => {
            audioRef.current = null;
            setVoiceState("idle");
            if (!isMuted && isOpen) {
              maybeRestartRecognition();
            }
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialize copilot";
        setError(message);
      } finally {
        setIsSessionLoading(false);
      }
    };

    void initSession();
  }, [isOpen, sessionId, isSessionLoading, authToken]);

  const openOverlay = () => {
    setSessionId("");
    setLastQuery("");
    setUiBlocks([]);
    setSuggestions(DEFAULT_SUGGESTIONS);
    setResponseText("Starting Copilot...");
    setIsOpen(true);
    setError(null);
  };

  const closeOverlay = () => {
    shouldAutoListenRef.current = false;
    stopRecognition();
    queryAbortRef.current?.abort();
    queryAbortRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    setPhase("closing");
    setVoiceState("idle");
    window.setTimeout(() => {
      setIsOpen(false);
      setPhase("closed");
    }, 320);
  };

  const applyQueryResult = async (result: CopilotQueryResponse, spokenQuery?: string) => {
    setResponseText(result.text || "No response available.");
    setUiBlocks(Array.isArray(result.ui_blocks) ? result.ui_blocks : []);
    setSuggestions(result.suggestions?.length ? result.suggestions : []);
    setLastQuery(spokenQuery || result.text || "");
    setQuery("");

    if (!isSpeakerEnabled || isMuted) {
      setVoiceState("idle");
      return;
    }

    const voiceResponse = result as CopilotVoiceResponse;
    if (!voiceResponse.audio_base64) {
      setVoiceState("idle");
      return;
    }

    setVoiceState("speaking");
    const audio = new Audio(`data:${voiceResponse.audio_mime_type || "audio/mpeg"};base64,${voiceResponse.audio_base64}`);
    audioRef.current = audio;
    try {
      await audio.play();
    } catch {
      setVoiceState("idle");
    }

    audio.onended = () => {
      audioRef.current = null;
      setVoiceState("idle");
      if (!isMuted && isOpen) {
        maybeRestartRecognition();
      }
    };
  };

  const submitVoiceBlob = async (blob: Blob) => {
    if (!sessionId || isQueryLoading) return;

    try {
      queryAbortRef.current?.abort();
      queryAbortRef.current = new AbortController();
      setIsQueryLoading(true);
      setVoiceState("thinking");
      setError(null);

      const formData = new FormData();
      formData.append("session_id", sessionId);
      formData.append("language", "en");
      formData.append("file", blob, "copilot-voice.webm");

      const response = await fetch(`${API_BASE_URL}/copilot/voice`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        signal: queryAbortRef.current.signal,
        body: formData,
      });

      const payload = (await response.json()) as CopilotVoiceResponse | { detail?: string };
      if (!response.ok) {
        throw new Error((payload as { detail?: string }).detail || "Failed to run copilot voice query");
      }

      await applyQueryResult(payload as CopilotVoiceResponse, (payload as CopilotVoiceResponse).transcript);
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? INTERRUPT_COPY
        : err instanceof Error
          ? err.message
          : "Failed to process voice input";
      setError(message);
      setVoiceState("idle");
    } finally {
      setIsQueryLoading(false);
      queryAbortRef.current = null;
    }
  };

  const startListening = () => {
    shouldAutoListenRef.current = true;
    transcriptBufferRef.current = "";
    clearSilenceTimer();

    if (!sessionId || isSessionLoading || isQueryLoading || isMuted) {
      return;
    }

    maybeRestartRecognition();
  };

  const stopListening = () => {
    shouldAutoListenRef.current = false;
    transcriptBufferRef.current = "";
    clearSilenceTimer();
    stopRecognition();
    setVoiceState("idle");
    setQuery("");
  };

  useEffect(() => {
    if (!isOpen || !sessionId || isSessionLoading || isMuted) {
      stopListening();
      return;
    }

    startListening();

    return () => {
      stopListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sessionId, isSessionLoading, isMuted]);

  useEffect(() => {
    if (!isOpen) {
      stopListening();
    }
    return () => {
      clearSilenceTimer();
    };
  }, [isOpen]);

  const submitQuery = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed || !sessionId || isQueryLoading) return;

    try {
      queryAbortRef.current?.abort();
      queryAbortRef.current = new AbortController();
      setIsQueryLoading(true);
      setVoiceState("thinking");
      setError(null);
      setLastQuery(trimmed);

      const response = await fetch(`${API_BASE_URL}/copilot/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        signal: queryAbortRef.current.signal,
        body: JSON.stringify({
          session_id: sessionId,
          query: trimmed,
        }),
      });

      const payload = (await response.json()) as CopilotQueryResponse | { detail?: string };
      if (!response.ok) {
        throw new Error((payload as { detail?: string }).detail || "Failed to run copilot query");
      }

      const result = payload as CopilotQueryResponse;
      await applyQueryResult(result, trimmed);
    } catch (err) {
      const message = err instanceof DOMException && err.name === "AbortError"
        ? INTERRUPT_COPY
        : err instanceof Error
          ? err.message
          : "Failed to fetch copilot response";
      setError(message);
      setVoiceState("idle");
    } finally {
      setIsQueryLoading(false);
      queryAbortRef.current = null;
    }
  };

  const interruptCopilot = () => {
    queryAbortRef.current?.abort();
    queryAbortRef.current = null;
    if (sessionId) {
      void fetch(`${API_BASE_URL}/copilot/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ session_id: sessionId }),
      }).catch(() => {
        // Ignore cancellation request errors; UI still stops local playback/listening.
      });
    }
    clearSilenceTimer();
    stopRecognition();
    shouldAutoListenRef.current = !isMuted;
    audioRef.current?.pause();
    audioRef.current = null;
    setQuery("");
    setVoiceState("idle");
    setIsQueryLoading(false);
    setResponseText(INTERRUPT_COPY);
    setSuggestions([]);
    setError(null);

    if (!isMuted) {
      window.setTimeout(() => {
        if (isOpen && sessionId && !isSessionLoading && !isQueryLoading) {
          maybeRestartRecognition();
        }
      }, 900);
    }
  };

  const renderUiBlock = (block: CopilotUiBlock, index: number) => {
    if (block.component === "gemini_insight_card") {
      return <GeminiInsightCard key={`insight-${index}`} {...block.props} />;
    }

    if (block.component === "stat_metric_card") {
      return <StatMetricCard key={`stat-${index}`} {...block.props} />;
    }

    if (block.component === "empty_state") {
      return (
        <div key={`empty-${index}`} className="rounded-card border bg-card p-3">
          <EmptyState {...block.props} />
        </div>
      );
    }

    if (block.component === "community_pulse_donut") {
      return (
        <div key={`pulse-${index}`} className="rounded-card border bg-card p-4 shadow-card">
          <CommunityPulseDonut {...block.props} />
        </div>
      );
    }

    if (block.component === "need_terrain_map") {
      return (
        <div key={`terrain-${index}`} className="rounded-card border bg-card p-3 shadow-card">
          <NeedTerrainMap {...block.props} />
        </div>
      );
    }

    if (block.component === "missions_live_map") {
      return (
        <div key={`missions-${index}`} className="rounded-card border bg-card p-3 shadow-card">
          <MissionsLiveMap {...block.props} />
        </div>
      );
    }

    if (block.component === "volunteer_avatar_card") {
      return <VolunteerAvatarCard key={`volunteer-${index}`} {...block.props} />;
    }

    return null;
  };

  return (
    <>
      {!isOpen ? (
        <motion.button
          aria-label="Open Nexus Copilot"
          onClick={openOverlay}
          className="fixed bottom-6 right-10 z-[70] grid h-16 w-16 place-items-center rounded-full bg-transparent p-0 shadow-none"
          animate={{ y: [0, -2, 0], scale: [1, 1.01, 1] }}
          transition={{ duration: 4.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <img src="/logo.png" alt="Nexus" className="h-16 w-16 rounded-full bg-transparent object-contain" />
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
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-full p-4 lg:p-5"
            >
              <div className="mx-auto h-full max-w-[1520px] rounded-3xl border border-primary/15 bg-white/50 p-4 shadow-[0_24px_80px_rgba(79,70,229,0.14)] lg:p-5">
                <header className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img src="/logo.png" alt="Nexus" className="h-9 w-9 bg-transparent object-contain" />
                    <p className="text-base font-bold text-primary">Nexus Copilot</p>
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
                    <div className="relative flex flex-col items-center text-center">
                      <img src="/logo.png" alt="Nexus" className="h-24 w-24 bg-transparent object-contain drop-shadow-[0_22px_70px_rgba(79,70,229,0.3)]" />
                      <h2 className="mt-4 bg-gradient-to-r from-[#3730A3] via-[#4F46E5] to-[#6366F1] bg-clip-text text-3xl font-extrabold text-transparent lg:text-5xl">
                        Nexus Copilot Ready
                      </h2>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground lg:text-base">
                        Real-time coordinator assistant connected to live backend data and existing dashboard components.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid h-[calc(100%-60px)] grid-cols-1 gap-3 lg:grid-cols-[1.1fr_2fr]">
                    <section className="rounded-2xl border border-primary/15 bg-card/90 p-4 shadow-card">
                      {error ? (
                        <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          <span>{error}</span>
                        </div>
                      ) : null}

                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Your command</p>
                      <div className="rounded-2xl border border-primary/15 bg-background px-3 py-2.5 text-sm text-foreground">
                        {lastQuery || "Type a request like: show Gemini insights"}
                      </div>

                      <p className="mb-2 mt-4 text-[10px] font-black uppercase tracking-[0.15em] text-primary">Copilot</p>
                      <div className="rounded-2xl gradient-primary px-3 py-3 text-sm leading-relaxed text-primary-foreground">
                        {isQueryLoading ? "Analyzing live coordinator data and assembling UI components..." : responseText}
                      </div>

                      <div className="mt-4 flex gap-2">
                        <input
                          type="text"
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void submitQuery(query);
                            }
                          }}
                          placeholder="Ask for Gemini insights, risk zones, dashboard summary..."
                          className="flex-1 rounded-xl border border-primary/20 bg-background px-3 py-2 text-sm outline-none"
                          disabled={isSessionLoading || !sessionId}
                        />
                        <Button
                          onClick={() => void submitQuery(query)}
                          disabled={!query.trim() || !sessionId || isQueryLoading}
                          className="rounded-xl"
                        >
                          Send
                        </Button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {suggestions.map((chip) => (
                          <button
                            key={chip}
                            onClick={() => void submitQuery(chip)}
                            disabled={isQueryLoading || !sessionId}
                            className="rounded-pill border border-primary/20 bg-background px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary-light disabled:opacity-60"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </section>

                    <section className="overflow-y-auto rounded-2xl border border-primary/15 bg-card/90 p-4 shadow-card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground">Live Components</h3>
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>

                      <div className="space-y-3">
                        {uiBlocks.length > 0 ? (
                            uiBlocks.map((block, index) => (
                              <div key={`${block.component}-${index}`} className={block.component === "need_terrain_map" || block.component === "missions_live_map" ? "xl:col-span-2" : ""}>
                                {renderUiBlock(block, index)}
                              </div>
                            ))
                        ) : (
                          <div className="rounded-card border bg-card p-3">
                            <EmptyState
                              heading="No Components Yet"
                              subtext="Run a copilot query to render real cards from existing coordinator pages."
                            />
                          </div>
                        )}
                      </div>
                    </section>
                  </div>
                )}

                {phase === "active" ? (
                  <div className="pointer-events-none fixed bottom-4 left-1/2 z-[95] -translate-x-1/2">
                    <div className="pointer-events-auto mx-auto inline-flex h-[72px] items-center gap-3 rounded-[999px] border border-primary/20 bg-white/88 px-3 shadow-[0_14px_42px_rgba(79,70,229,0.16)] backdrop-blur-md">
                      <motion.button
                        type="button"
                        className="grid h-[52px] w-[52px] place-items-center rounded-full bg-transparent p-0"
                        aria-label="Nexus status"
                        animate={voiceState === "speaking" ? { rotate: 360 } : { rotate: 0 }}
                        transition={voiceState === "speaking" ? { duration: 1.6, repeat: Infinity, ease: "linear" } : { duration: 0 }}
                      >
                        <img src="/logo.png" alt="Nexus" className="h-10 w-10 rounded-full object-contain" />
                      </motion.button>

                      <div className="flex h-10 items-center self-center rounded-xl px-1 leading-none">
                        <VoiceWave state={voiceState} />
                      </div>

                      <Button
                        size="lg"
                        variant="secondary"
                        className={cn(
                          "h-[46px] min-w-[120px] rounded-full bg-white text-[#1E1B4B]",
                          isMuted && "bg-orange-50 border border-orange-200 text-orange-600"
                        )}
                        onClick={() => {
                          setIsMuted((prev) => {
                            const nextMuted = !prev;
                            if (nextMuted) {
                              stopListening();
                            } else {
                              window.setTimeout(() => {
                                if (!isOpen || !sessionId || isSessionLoading || isQueryLoading) return;
                                shouldAutoListenRef.current = true;
                                maybeRestartRecognition();
                              }, 100);
                            }
                            return nextMuted;
                          });
                        }}
                      >
                        <MicOff className="h-4 w-4" />
                        {isMuted ? "Unmute" : "Mute"}
                      </Button>

                      <Button
                        size="lg"
                        variant="secondary"
                        className="h-[46px] min-w-[140px] rounded-full border border-destructive/20 bg-[#FDEDEE] text-destructive"
                        onClick={() => {
                          interruptCopilot();
                        }}
                      >
                        <Hand className="h-4 w-4" />
                        Interrupt
                      </Button>

                      <button
                        onClick={() => {
                          setIsSpeakerEnabled((prev) => {
                            const nextEnabled = !prev;
                            if (!nextEnabled) {
                              audioRef.current?.pause();
                              if (voiceState === "speaking") {
                                setVoiceState("idle");
                              }
                            }
                            return nextEnabled;
                          });
                        }}
                        className={cn(
                          "grid h-[46px] w-[46px] place-items-center rounded-full transition-colors",
                          isSpeakerEnabled ? "bg-primary/10 text-primary hover:bg-primary/15" : "bg-gray-100 text-gray-400"
                        )}
                        aria-label="Toggle speaker"
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
