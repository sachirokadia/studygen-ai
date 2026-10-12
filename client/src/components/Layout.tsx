import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Coins, Home, Layers, Smile, Star } from "lucide-react";
import clsx from "clsx";
import { useLang, type I18nKey } from "../lib/i18n";
import { api, type TodayStats } from "../lib/api";

function TodayTag() {
  const now = new Date();
  const label = now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  return (
    <span className="date-tag" aria-label={label}>
      <span aria-hidden="true">📅</span>
      {label}
    </span>
  );
}

function Wallet() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ["today"], queryFn: () => api.get<TodayStats>("/study/today") });
  return (
    <span className="wallet" title={t("nav.coins")} aria-label={t("nav.coins")}>
      <Coins className="h-4 w-4 text-playorange" strokeWidth={2.75} />
      {data?.xpToday ?? 0}
    </span>
  );
}

// Four big things: HOME / MY CARDS / STUDY / ME
const MAIN_NAV: { to: string; key: I18nKey; icon: typeof Home; color: string; soft: string }[] = [
  { to: "/", key: "nav.home", icon: Home, color: "bg-playgreen", soft: "bg-mint" },
  { to: "/decks", key: "nav.mycards", icon: Layers, color: "bg-playblue", soft: "bg-ice" },
  { to: "/review", key: "nav.practice", icon: Star, color: "bg-playyellow", soft: "bg-butter" },
  { to: "/me", key: "nav.me", icon: Smile, color: "bg-playpink", soft: "bg-blush" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useLang();

  return (
    <div className="min-h-screen pb-28 md:pb-6">
      {/* ===== Top bar: date pill | XP pill ===== */}
      <header className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex items-center gap-2.5">
          <TodayTag />
          <Wallet />
          <div className="flex-1" />

          {/* ===== Desktop nav: soft white pill bar (md and up) ===== */}
          <nav
            className="hidden items-center gap-1 rounded-full bg-white p-1.5 md:flex"
            style={{ boxShadow: "0 8px 20px -10px rgba(90,70,130,0.25)" }}
            aria-label="Sections"
          >
            {MAIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                title={t(item.key)}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2 rounded-full px-4 py-2 font-display text-sm font-extrabold transition",
                    isActive ? clsx(item.soft, "text-ink") : "text-ink/55 hover:bg-cream",
                  )
                }
              >
                <span className={clsx("flex h-8 w-8 items-center justify-center rounded-full text-white", item.color)}>
                  <item.icon className="h-4 w-4" strokeWidth={2.75} />
                </span>
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* ===== Bottom nav: 4 soft tiles (mobile only — desktop uses the top pill bar) ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pt-2 md:hidden"
        aria-label="Main"
      >
        <div
          className="grid grid-cols-4 gap-2 rounded-[24px] bg-white/95 p-2 backdrop-blur"
          style={{ boxShadow: "0 -8px 30px -12px rgba(90,70,130,0.3)" }}
        >
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => clsx("nav-tag", isActive && "nav-tag-active")}
            >
              {({ isActive }) => (
                <>
                  <span className={clsx("flex h-9 w-9 items-center justify-center rounded-full text-white", item.color, !isActive && "opacity-80")}>
                    <item.icon className="h-5 w-5" strokeWidth={2.75} />
                  </span>
                  {t(item.key)}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
