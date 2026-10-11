import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Calendar,
  Coins,
  Fence,
  Hand,
  Layers,
  LogOut,
  Map,
  MessageCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Bookmark,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../lib/auth";
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
  const { data } = useQuery({ queryKey: ["today"], queryFn: () => api.get<TodayStats>("/study/today") });
  return (
    <span className="wallet" title="XP today">
      <Coins className="h-4 w-4" strokeWidth={2.75} />
      {data?.xpToday ?? 0}
    </span>
  );
}

const CHAIN_NAV = [
  { to: "/", label: "Today", icon: Calendar, color: "bg-grass" },
  { to: "/decks", label: "Yard", icon: Fence, color: "bg-sky" },
  { to: "/review", label: "Cards", icon: Layers, color: "bg-btnyellow" },
  { to: "/notes", label: "Notes", icon: StickyNote, color: "bg-btnpink" },
  { to: "/paths", label: "Paths", icon: Map, color: "bg-machinepurple" },
];

const BOTTOM_NAV: { to: string; key: I18nKey; icon: typeof Calendar }[] = [
  { to: "/", key: "nav.today", icon: Calendar },
  { to: "/decks", key: "nav.yard", icon: Fence },
  { to: "/review", key: "nav.cards", icon: Layers },
  { to: "/notes", key: "nav.notes", icon: StickyNote },
  { to: "/paths", key: "nav.paths", icon: Map },
  { to: "/explain", key: "nav.explain", icon: Sparkles },
  { to: "/chat", key: "nav.chat", icon: MessageCircle },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useLang();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen pb-28 md:pb-10">
      {/* ===== Top bar: date tag | wallet | gear | book | pink hand ===== */}
      <header className="mx-auto max-w-6xl px-4 pt-4">
        <div className="flex items-center gap-2.5">
          <TodayTag />
          <Wallet />
          <div className="flex-1" />
          <button className="icon-round" onClick={() => setMenuOpen((o) => !o)} aria-label="Settings" title="Menu">
            <Settings className="h-5 w-5" strokeWidth={2.75} />
          </button>
          <NavLink to="/notes" className="icon-round" aria-label="Notes" title={t("nav.notes")}>
            <BookOpen className="h-5 w-5" strokeWidth={2.75} />
          </NavLink>
          <NavLink to="/chat" aria-label="Chat" title={t("nav.chat")}
            className="flex h-10 w-10 items-center justify-center rounded-full border-[2.5px] border-ink bg-handpink"
            style={{ boxShadow: "2px 2px 0 #2B2B2B" }}>
            <Hand className="h-5 w-5" strokeWidth={2.75} />
          </NavLink>
        </div>

        {/* ===== Metal chain with 5 circular hanging tags ===== */}
        <div className="relative mt-4">
          <div className="chain-metal" aria-hidden="true" />
          <nav className="flex items-start justify-center gap-3 px-4 md:gap-5" aria-label="Sections">
            {CHAIN_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                title={item.label}
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

        {/* User dropdown */}
        {menuOpen && (
          <div className="paper-card relative z-50 mx-auto mt-3 max-w-xs p-4">
            <div className="font-display text-xl font-extrabold uppercase">{user?.name}</div>
            <div className="font-body text-xs font-bold text-ink/60">{user?.email}</div>
            <div className="mt-3 flex flex-col gap-2">
              <NavLink to="/bookmarks" className="btn-cream btn-sm w-full" onClick={() => setMenuOpen(false)}>
                <Bookmark className="h-4 w-4" strokeWidth={2.75} />
                {t("nav.bookmarks")}
              </NavLink>
              {user?.role === "admin" && (
                <NavLink to="/admin" className="btn-cream btn-sm w-full" onClick={() => setMenuOpen(false)}>
                  <ShieldCheck className="h-4 w-4" strokeWidth={2.75} />
                  {t("nav.admin")}
                </NavLink>
              )}
              <button onClick={handleLogout} className="btn-pink btn-sm w-full">
                <LogOut className="h-4 w-4" strokeWidth={2.75} />
                {t("btn.logout")}
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      {/* ===== Bottom nav: paper tags ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-paper/95 px-3 pb-3 pt-2 backdrop-blur md:static md:mx-auto md:mt-8 md:max-w-6xl md:border-[3px] md:bg-transparent md:px-4 md:backdrop-blur-none"
        aria-label="Main"
      >
        <div className="grid grid-cols-4 gap-2 md:flex md:flex-wrap md:justify-center md:gap-3">
          {BOTTOM_NAV.map((item) => (
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
          <button className="nav-tag" onClick={() => setMenuOpen((o) => !o)}>
            <Settings className="h-5 w-5" strokeWidth={2.75} />
            {t("nav.me")}
          </button>
        </div>
      </nav>
    </div>
  );
}
