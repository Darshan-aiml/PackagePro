"use client";

import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  Bot,
  ChevronUp,
  Send,
  Wrench,
  Sparkles,
  MapPin,
  ArrowRight,
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { springTap } from "@/lib/motion";
import { COOKIE_NAME, DEMO_USERS } from "@/lib/demo";

interface ToolStep {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  result: { output: string };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolSteps?: ToolStep[];
}

export function ChatWidget() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [activeUser, setActiveUser] = useState<string>(() => {
    if (typeof window === "undefined") return "usr_6afe5712";
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${COOKIE_NAME}=`));
    return match ? match.split("=")[1] : "usr_6afe5712";
  });

  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return (
      localStorage.getItem("packagepro-chat-session") ?? crypto.randomUUID()
    );
  });

  // Track active user changes in cookies
  useEffect(() => {
    const updateCookieUser = () => {
      const match = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${COOKIE_NAME}=`));
      if (match) setActiveUser(match.split("=")[1]);
    };
    window.addEventListener("focus", updateCookieUser);
    return () => window.removeEventListener("focus", updateCookieUser);
  }, []);

  const sendPrompt = useCallback(
    async (textToSend: string) => {
      const msg = textToSend.trim();
      if (!msg || thinking) return;
      setInput("");
      setThinking(true);
      setMessages((prev) => [...prev, { role: "user", content: msg }]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: msg,
            locale,
            userId: activeUser,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(json.error ?? "Agent failed");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: json.content,
            toolSteps: json.toolSteps ?? [],
          },
        ]);
      } catch (err) {
        const msg2 = err instanceof Error ? err.message : t("error");
        setMessages((prev) => [...prev, { role: "assistant", content: msg2 }]);
      } finally {
        setThinking(false);
      }
    },
    [thinking, sessionId, locale, activeUser, t],
  );

  // Global listener for "open-packagepro-agent" custom events
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const ce = e as CustomEvent<{ prompt?: string }>;
      setOpen(true);
      if (ce.detail?.prompt) {
        void sendPrompt(ce.detail.prompt);
      }
    };
    window.addEventListener("open-packagepro-agent", handleOpen);
    return () => window.removeEventListener("open-packagepro-agent", handleOpen);
  }, [sendPrompt]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async () => {
    if (!input.trim() || thinking) return;
    await sendPrompt(input);
  };

  const currentTraveller =
    DEMO_USERS.find((u) => u.id === activeUser) ?? DEMO_USERS[2];

  const quickChips = [
    { label: t("chipRecommend"), prompt: "Can you recommend tour packages for me based on my profile?" },
    { label: t("chipJodhpur"), prompt: "What tour packages and activities do you have in Jodhpur?" },
    { label: t("chipSwap"), prompt: "In Jodhpur Heritage (pkg_55c9e36a), what happens if I swap Hot Springs for Jazz Cellar?" },
    { label: t("chipPlan"), prompt: "Plan a 3-day trip to Jodhpur for 2 adults with a budget of ₹40,000 from 2026-09-14 to 2026-09-16." },
    { label: t("chipCompare"), prompt: "Compare the Manali adventure tour and the Gangtok heritage tour." },
  ];

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        {...springTap}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("toggle")}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-2xl transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <ChevronUp className="h-6 w-6" key="close" />
          ) : (
            <div className="relative" key="open">
              <Bot className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-paper opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-paper"></span>
              </span>
            </div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Floating Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="fixed bottom-24 right-4 z-50 w-[calc(100vw-2rem)] max-h-[75vh] flex flex-col rounded-3xl border hairline bg-raised shadow-2xl sm:right-6 sm:w-[440px]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b hairline px-4 py-3 bg-paper/50 rounded-t-3xl backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-ink font-semibold text-xs">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold tracking-tight">
                      {t("title")}
                    </h2>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      AI Agent
                    </span>
                  </div>
                  <p className="text-[11px] text-muted flex items-center gap-1">
                    <span>{currentTraveller.name}</span>
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: currentTraveller.accent }}
                    />
                    <span>• Exact INR Engine</span>
                  </p>
                </div>
              </div>
              <motion.button
                {...springTap}
                onClick={() => setOpen(false)}
                className="rounded-full p-1 text-muted hover:bg-paper hover:text-ink text-xs"
              >
                ✕
              </motion.button>
            </div>

            {/* Messages Body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {messages.length === 0 && !thinking && (
                <div className="space-y-3 py-2">
                  <div className="rounded-2xl border hairline bg-paper p-3 text-xs text-muted leading-relaxed">
                    <p className="font-medium text-ink mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-accent" />
                      {t("title")}
                    </p>
                    {t("subtitle")}
                  </div>

                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted px-1">
                    Try asking:
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {quickChips.map((chip, idx) => (
                      <motion.button
                        key={idx}
                        {...springTap}
                        onClick={() => void sendPrompt(chip.prompt)}
                        className="w-full text-left rounded-xl border hairline bg-paper px-3 py-2 text-xs text-ink transition-colors hover:border-accent hover:bg-accent/5 flex items-center justify-between group"
                      >
                        <span>{chip.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col gap-1 ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div className="flex gap-2 max-w-[92%]">
                    {msg.role === "assistant" && (
                      <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                        <Bot className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 text-sm ${
                        msg.role === "user"
                          ? "bg-accent text-accent-ink rounded-tr-sm"
                          : "bg-paper text-ink border hairline rounded-tl-sm shadow-sm"
                      }`}
                    >
                      <div className="whitespace-pre-wrap leading-relaxed text-xs sm:text-sm">
                        {msg.content}
                      </div>

                      {/* Tool Executions Badge & Details */}
                      {msg.toolSteps && msg.toolSteps.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t hairline space-y-2">
                          <details className="group">
                            <summary className="cursor-pointer text-[11px] font-medium text-muted hover:text-ink flex items-center gap-1">
                              <Wrench className="h-3 w-3 text-accent" />
                              <span>
                                {msg.toolSteps.length} {t("tools")}
                              </span>
                              <span className="text-[10px] text-muted/70">
                                (click to inspect)
                              </span>
                            </summary>
                            <div className="mt-1.5 space-y-1.5 text-[11px] text-muted">
                              {msg.toolSteps.map((ts) => (
                                <div
                                  key={ts.toolCallId}
                                  className="rounded bg-ink/5 p-2 font-mono text-[10px]"
                                >
                                  <div className="flex items-center justify-between text-ink font-semibold">
                                    <span>⚡ {ts.name}</span>
                                  </div>
                                  <div className="text-muted truncate mt-0.5">
                                    Args: {JSON.stringify(ts.args)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>

                          {/* Render Rich Interactive Action Cards */}
                          {msg.toolSteps.map((ts) => (
                            <InteractiveToolCard
                              key={ts.toolCallId}
                              step={ts}
                              onNavigate={(url) => {
                                setOpen(false);
                                router.push(url);
                              }}
                              t={t}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {thinking && (
                <div className="flex gap-2">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex items-center gap-2 rounded-2xl bg-paper px-3.5 py-2 text-xs text-muted border hairline">
                    <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
                    <span>{t("thinking")}</span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input Form */}
            <div className="border-t hairline px-3 py-3 bg-paper/40 rounded-b-3xl">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("placeholder")}
                  disabled={thinking}
                  className="flex-1 rounded-full border hairline bg-paper px-4 py-2 text-xs sm:text-sm outline-none focus:border-accent transition-colors disabled:opacity-50"
                />
                <motion.button
                  {...springTap}
                  type="submit"
                  disabled={thinking || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-colors hover:bg-accent-deep disabled:opacity-40"
                  aria-label={t("send")}
                >
                  <Send className="h-4 w-4" strokeWidth={2.25} />
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------
// Interactive Action Cards inside Chat
// ---------------------------------------------------------------------------
interface SwapData {
  success?: boolean;
  priceDeltaINR?: string;
  originalComponent?: { title: string };
  newComponent?: { title: string };
  newTotalINR?: string;
  configuratorUrl?: string;
}

interface PlanData {
  success?: boolean;
  city?: string;
  startDate?: string;
  endDate?: string;
  overBudget?: boolean;
  totalCostINR?: string;
  hotel?: { name: string };
  guide?: { name: string };
  plannerUrl?: string;
}

interface PackageCardData {
  packageId: string;
  name: string;
  city: string;
  tier: string;
  basePriceINR: string;
  durationDays?: number;
}

function InteractiveToolCard({
  step,
  onNavigate,
  t,
}: {
  step: ToolStep;
  onNavigate: (url: string) => void;
  t: (key: string) => string;
}) {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(step.result.output);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || "error" in parsed) return null;
  const data = parsed as Record<string, unknown>;

  // 1. Swap Component Card (The Signature Feature)
  if (step.name === "swap_component" && data.success) {
    const swap = data as unknown as SwapData;
    return (
      <div className="mt-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-ink flex items-center gap-1">
            <ArrowRightLeft className="h-3.5 w-3.5 text-accent" />
            Component Swapped
          </span>
          <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent-ink">
            {swap.priceDeltaINR}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-paper p-2 border hairline">
          <div className="truncate max-w-[42%] text-muted">
            <span className="block text-[9px] uppercase">From</span>
            <span className="truncate block font-medium text-ink">
              {swap.originalComponent?.title}
            </span>
          </div>
          <ArrowRight className="h-3.5 w-3.5 text-muted shrink-0" />
          <div className="truncate max-w-[42%] text-right">
            <span className="block text-[9px] uppercase text-accent font-semibold">
              To
            </span>
            <span className="truncate block font-medium text-ink">
              {swap.newComponent?.title}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-muted">
            {t("newTotal")}: <strong className="text-ink font-mono">{swap.newTotalINR}</strong>
          </span>
          {swap.configuratorUrl && (
            <motion.button
              {...springTap}
              onClick={() => onNavigate(swap.configuratorUrl!)}
              className="flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[10px] font-medium text-paper hover:bg-accent-deep"
            >
              <span>{t("customize")}</span>
              <ExternalLink className="h-3 w-3" />
            </motion.button>
          )}
        </div>
      </div>
    );
  }

  // 2. Plan Trip Card
  if (step.name === "plan_trip" && data.success) {
    const plan = data as unknown as PlanData;
    const isOver = plan.overBudget;
    return (
      <div className="mt-2 rounded-xl border hairline bg-paper p-3 text-xs space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-ink flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-accent" />
            {plan.city} ({plan.startDate} → {plan.endDate})
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isOver
                ? "bg-amber-500/10 text-amber-600"
                : "bg-emerald-500/10 text-emerald-600"
            }`}
          >
            {isOver ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            {isOver ? t("overBudget") : t("withinBudget")}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px] bg-ink/5 p-2 rounded-lg">
          <div>
            <span className="text-muted block text-[10px]">Total Cost</span>
            <strong className="font-mono text-ink text-xs">{plan.totalCostINR}</strong>
          </div>
          <div>
            <span className="text-muted block text-[10px]">Stay & Guide</span>
            <span className="truncate block font-medium">
              {plan.hotel?.name?.slice(0, 15) ?? "Stay"} + {plan.guide?.name?.slice(0, 10) ?? "Guide"}
            </span>
          </div>
        </div>

        {plan.plannerUrl && (
          <motion.button
            {...springTap}
            onClick={() => onNavigate(plan.plannerUrl!)}
            className="w-full flex items-center justify-center gap-1.5 rounded-full bg-ink py-1.5 text-[11px] font-semibold text-paper hover:bg-accent-deep"
          >
            <span>{t("openPlanner")}</span>
            <ArrowRight className="h-3 w-3" />
          </motion.button>
        )}
      </div>
    );
  }

  // 3. Package Recommendation / List Card
  const packagesList = (data.packages || data.recommendations) as PackageCardData[] | undefined;
  if (
    (step.name === "list_packages" || step.name === "recommend_packages") &&
    Array.isArray(packagesList) &&
    packagesList.length > 0
  ) {
    const previewList = packagesList.slice(0, 2);
    return (
      <div className="mt-2 space-y-1.5">
        {previewList.map((pkg) => (
          <div
            key={pkg.packageId}
            className="rounded-xl border hairline bg-paper p-2.5 text-xs flex items-center justify-between gap-2 hover:border-accent transition-colors"
          >
            <div className="truncate">
              <span className="font-semibold text-ink block truncate">
                {pkg.name}
              </span>
              <div className="flex items-center gap-1.5 text-[10px] text-muted mt-0.5">
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-2.5 w-2.5" />
                  {pkg.city}
                </span>
                <span>•</span>
                <span className="uppercase">{pkg.tier}</span>
                <span>•</span>
                <strong className="text-ink font-mono">{pkg.basePriceINR}</strong>
              </div>
            </div>

            <motion.button
              {...springTap}
              onClick={() => onNavigate(`/packages/${pkg.packageId}`)}
              className="shrink-0 rounded-full border hairline px-2.5 py-1 text-[10px] font-medium text-ink hover:bg-accent hover:text-accent-ink transition-colors flex items-center gap-1"
            >
              <span>{t("viewPackage")}</span>
              <ArrowRight className="h-2.5 w-2.5" />
            </motion.button>
          </div>
        ))}
      </div>
    );
  }

  // 4. Compare Packages Card
  const compareList = data.packages as PackageCardData[] | undefined;
  if (step.name === "compare_packages" && Array.isArray(compareList)) {
    return (
      <div className="mt-2 rounded-xl border hairline bg-paper p-2.5 text-xs space-y-2">
        <div className="font-semibold text-ink text-[11px]">
          Comparison Overview ({String(data.priceDeltaBetweenFirstTwo ?? "")})
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          {compareList.slice(0, 2).map((p) => (
            <div key={p.packageId} className="border hairline rounded-lg p-2 bg-ink/5">
              <div className="font-bold truncate text-ink">{p.name}</div>
              <div className="text-muted">{p.city} • {p.durationDays}d</div>
              <div className="font-mono font-semibold text-ink mt-1">{p.basePriceINR}</div>
              <motion.button
                {...springTap}
                onClick={() => onNavigate(`/packages/${p.packageId}`)}
                className="mt-1.5 w-full text-center rounded bg-ink px-1.5 py-0.5 text-[9px] text-paper font-medium"
              >
                Inspect
              </motion.button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
