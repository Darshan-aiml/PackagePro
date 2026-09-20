"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Bot, ChevronUp, Send, Wrench, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { springTap } from "@/lib/motion";

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
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [sessionId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("packagepro-chat-session") ?? crypto.randomUUID();
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || thinking) return;
    setInput("");
    setThinking(true);
    setMessages((prev) => [...prev, { role: "user", content: msg }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          message: msg,
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
  };

  const planThis = (cityId: string) => {
    setOpen(false);
    router.push(`/plan?city=${cityId}`);
  };

  const browsePackages = () => {
    setOpen(false);
    router.push("/");
  };

  return (
    <>
      {/* Toggle */}
      <motion.button
        {...springTap}
        onClick={() => setOpen((o) => !o)}
        aria-label={t("toggle")}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg transition-colors hover:bg-accent-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <ChevronUp className="h-6 w-6" key="close" />
          ) : (
            <Bot className="h-6 w-6" key="open" />
          )}
        </AnimatePresence>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed bottom-24 right-6 z-50 w-[340px] max-h-[60vh] flex flex-col rounded-3xl border hairline bg-raised shadow-2xl sm:w-[400px]"
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b hairline px-4 py-3">
              <Sparkles className="h-4 w-4 text-accent" strokeWidth={2} />
              <h2 className="text-sm font-semibold tracking-tight">{t("title")}</h2>
              <p className="ml-1 truncate text-[11px] text-muted">{t("subtitle")}</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && !thinking && (
                <p className="text-sm text-muted">{t("empty")}</p>
              )}
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                      <Bot className="h-3 w-3" />
                    </span>
                  )}
                  <div
                    className={`max-w-[80%] ${
                      msg.role === "user"
                        ? "rounded-2xl bg-accent px-3 py-2 text-sm text-accent-ink"
                        : "rounded-2xl bg-paper px-3 py-2 text-sm text-ink"
                    }`}
                  >
                    {msg.content}
                    {msg.toolSteps && msg.toolSteps.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] text-muted hover:text-ink">
                          <Wrench className="mr-1 inline h-3 w-3" />
                          {msg.toolSteps.length} {t("tools")}
                        </summary>
                        <ul className="mt-1 space-y-1 text-[11px] text-muted">
                          {msg.toolSteps.map((ts) => (
                            <li key={ts.toolCallId}>
                              <strong>{ts.name}</strong>(
                              {JSON.stringify(ts.args).slice(0, 60)}
                              )
                              <details className="ml-2">
                                <summary className="cursor-pointer hover:text-ink">
                                  {t("result")}
                                </summary>
                                <pre className="mt-1 max-h-24 overflow-auto rounded bg-ink/5 p-1.5 text-[10px]">
                                  {JSON.stringify(
                                    JSON.parse(ts.result.output),
                                    null,
                                    2,
                                  ).slice(0, 400)}
                                </pre>
                              </details>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    {/* Inline action links for structured results */}
                    {msg.content.includes("plan") && (
                      <div className="mt-2 flex gap-2">
                        <motion.button
                          {...springTap}
                          onClick={() => planThis("")}
                          className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-paper hover:bg-accent-deep"
                        >
                          {t("plan")}
                        </motion.button>
                        <motion.button
                          {...springTap}
                          onClick={browsePackages}
                          className="rounded-full border hairline px-3 py-1 text-[11px] font-medium text-ink hover:bg-paper"
                        >
                          {t("packages")}
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="flex gap-2">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-paper">
                    <Bot className="h-3 w-3" />
                  </span>
                  <span className="rounded-2xl bg-paper px-3 py-2 text-sm text-muted">
                    {t("thinking")}
                  </span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t hairline px-3 py-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("placeholder")}
                  className="flex-1 rounded-full border hairline bg-paper px-4 py-2 text-sm outline-none focus:border-accent transition-colors"
                />
<motion.button
                   {...springTap}
                   type="submit"
                   disabled={thinking || !input.trim()}
                   className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink transition-colors hover:bg-accent-deep disabled:opacity-40"
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
