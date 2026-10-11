import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Coins, Home, Layers, Smile, Star } from "lucide-react";
import clsx from "clsx";
import { useLang, type I18nKey } from "../lib/i18n";
import { api, type TodayStats } from "../lib/api";
import { HangCircle } from "./ui";

function TodayTag() {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" }).toUpperCase();
  return (
    <span className="date-tag">
      <span>{month}</span>
      <span className="text-lg leading-none">{now.getDate()}</span>
    </span>
  );
}

function Wallet() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ["today"], queryFn: () => api.get<TodayStats>("/study/today") });
  return (
    <span className="wallet" title={t("nav.coins")} aria-label={t("nav.coins")}>
      <Coins className="h-4 w-4" strokeWidth={2.75} />
      {data?.xpToday ?? 0}
    </span>
  );
}

// Four big things, like the reference: HOME / MY CARDS / STUDY / ME
const MAIN_NAV: { to: string; key: I18nKey; icon: typeof Home; color: string }[] = [
  { to: "/", key: "nav.home", icon: Home, color: "bg-grass" },
  { to: "/decks", key: "nav.mycards", icon: Layers, color: "bg-sky" },
  { to: "/review", key: "nav.practice", icon: Star, color: "bg-btnyellow" },
  { to: "/me", key: "nav.me", icon: Smile, color: "bg-btnpink" },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useLang();

  return (
    <div className="min-h-screen pb-28 md:pb-10">
      {/* ===== Top bar: date tag | wallet ===== */}
      <header className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex items-center gap-2.5">
          <TodayTag />
          <Wallet />
          <div className="flex-1" />
        </div>

        {/* ===== Metal chain with 4 circular hanging tags ===== */}
        <div className="relative mt-4">
          <div className="chain-metal" aria-hidden="true" />
          <nav className="flex items-start justify-center gap-3 px-4 md:gap-5" aria-label="Sections">
            {MAIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                title={t(item.key)}
                className={({ isActive }) => clsx("-mt-2", isActive && "relative")}
              >
                {({ isActive }) => (
                  <HangCircle color={item.color} active={isActive}>
                    <item.icon className="h-5 w-5" strokeWidth={2.75} />
                  </HangCircle>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* ===== Bottom nav: 4 paper tags ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-paper/95 px-3 pb-3 pt-2 backdrop-blur md:static md:mx-auto md:mt-8 md:max-w-6xl md:border-[3px] md:bg-transparent md:px-4 md:backdrop-blur-none"
        aria-label="Main"
      >
        <div className="grid grid-cols-4 gap-2 md:flex md:flex-wrap md:justify-center md:gap-3">
          {MAIN_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => clsx("nav-tag", isActive && "nav-tag-active")}
            >
              <item.icon className="h-5 w-5" strokeWidth={2.75} />
              {t(item.key)}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
