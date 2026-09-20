"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { ChevronDown, X } from "lucide-react";
import { DEMO_USERS, COOKIE_NAME } from "@/lib/demo";
import { springTap } from "@/lib/motion";

export function UserPicker({ currentUserId }: { currentUserId: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const current = DEMO_USERS.find((u) => u.id === currentUserId) ?? DEMO_USERS[2];

  const pick = (id: string) => {
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${COOKIE_NAME}=${id};path=/;max-age=${60 * 60 * 24 * 365}`;
    setOpen(false);
    window.location.reload();
  };

  return (
    <>
      <motion.button
        {...springTap}
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border hairline bg-raised/70 hover:bg-raised"
        aria-haspopup="dialog"
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: current.accent }}
        />
        <span className="font-medium">{current.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted" strokeWidth={1.75} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-ink/25 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t("user.title")}
              initial={{ y: 24, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 16, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="relative w-full max-w-md rounded-3xl bg-raised p-6 shadow-2xl border hairline"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    {t("user.title")}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted">{t("user.subtitle")}</p>
                </div>
                <motion.button
                  {...springTap}
                  onClick={() => setOpen(false)}
                  className="rounded-full p-1.5 text-muted hover:bg-paper hover:text-ink"
                  aria-label={t("user.close")}
                >
                  <X className="h-4 w-4" />
                </motion.button>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                {DEMO_USERS.map((u) => (
                  <motion.button
                    key={u.id}
                    {...springTap}
                    onClick={() => pick(u.id)}
                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors ${
                      u.id === currentUserId
                        ? "border-ink/30 bg-paper"
                        : "hairline bg-transparent hover:bg-paper"
                    }`}
                  >
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ background: u.accent }}
                    >
                      {u.name
                        .split(" ")
                        .map((p) => p[0])
                        .join("")}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{u.name}</span>
                      <span className="block text-xs text-muted">
                        {t(`user.${u.key}`)}
                      </span>
                    </span>
                    {u.id === currentUserId && (
                      <span className="text-xs font-medium text-muted">
                        ✓
                      </span>
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}