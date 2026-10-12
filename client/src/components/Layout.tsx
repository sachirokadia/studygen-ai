import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bookmark,
  ChevronRight,
  Coins,
  Home,
  Layers,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Route,
  Smile,
  Sparkles,
  Star,
  StickyNote,
  Timer,
} from "lucide-react";
import clsx from "clsx";
import { useLang, type I18nKey } from "../lib/i18n";
import { api, type TodayStats } from "../lib/api";
import { Modal } from "./ui";

type NavItem = { to: string; key: I18nKey; icon: typeof Home; tint: string };

const PRIMARY_NAV: { to: string; key: I18nKey; icon: typeof Home; end?: boolean }[] = [
  { to: "/", key: "nav.home", icon: Home, end: true },
  { to: "/decks", key: "nav.mycards", icon: Layers },
  { to: "/review", key: "nav.practice", icon: Star },
];

const MORE_NAV: NavItem[] = [
  { to: "/notes", key: "nav.notes", icon: StickyNote, tint: "bg-lavender" },
  { to: "/paths", key: "nav.paths", icon: Route, tint: "bg-mint" },
  { to: "/explain", key: "nav.explain", icon: Sparkles, tint: "bg-peach" },
  { to: "/chat", key: "nav.chat", icon: MessageCircle, tint: "bg-sky" },
  { to: "/focus", key: "nav.focus", icon: Timer, tint: "bg-lavender" },
  { to: "/bookmarks", key: "nav.bookmarks", icon: Bookmark, tint: "bg-peach" },
  { to: "/me", key: "nav.me", icon: Smile, tint: "bg-mint" },
];

const CREATE_GRADIENT = { background: "linear-gradient(135deg, #FFA94D 0%, #FF5FA2 100%)" };

function XpChip() {
  const { t } = useLang();
  const { data } = useQuery({ queryKey: ["today"], queryFn: () => api.get<TodayStats>("/study/today") });
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3.5 py-1.5 text-sm font-extrabold text-ink"
      title={t("nav.coins")}
      aria-label={t("nav.coins")}
    >
      <Coins className="h-4 w-4 text-tangerine" strokeWidth={2.5} />
      {data?.xpToday ?? 0}
    </span>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { t } = useLang();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const goCreate = () => navigate("/decks");

  return (
    <div className="min-h-screen md:flex md:gap-5 md:p-4 lg:p-6">
      {/* ===== Desktop sidebar (md and up) ===== */}
      <aside
        className="sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col rounded-[24px] bg-white p-4 shadow-card md:flex lg:top-6 lg:h-[calc(100vh-3rem)]"
        aria-label="Sections"
      >
        <div className="mb-6 flex items-center gap-2.5 px-2 pt-2">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-glow"
            style={CREATE_GRADIENT}
            aria-hidden="true"
          >
            <Sparkles className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <span className="text-lg font-extrabold tracking-tight text-ink">StudyGen</span>
        </div>

        <nav className="flex flex-col gap-1">
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-bold transition active:scale-[0.98]",
                  isActive ? "bg-peach text-tangerine" : "text-ink/70 hover:bg-mist",
                )
              }
            >
              <item.icon className="h-5 w-5" strokeWidth={2.5} />
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={goCreate}
          className="btn-primary mt-3 !h-12 text-sm"
          aria-label={t("decks.newPack")}
        >
          <Plus className="h-5 w-5" strokeWidth={2.75} />
          {t("decks.newPack")}
        </button>

        <p className="mb-1 mt-6 px-3 text-[11px] font-extrabold uppercase tracking-widest text-muted">
          More
        </p>
        <nav className="flex flex-col gap-0.5">
          {MORE_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold transition active:scale-[0.98]",
                  isActive ? "bg-peach text-tangerine" : "text-ink/70 hover:bg-mist",
                )
              }
            >
              <span className={clsx("flex h-8 w-8 items-center justify-center rounded-xl", item.tint)}>
                <item.icon className="h-4 w-4 text-ink" strokeWidth={2.5} />
              </span>
              {t(item.key)}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex justify-center pb-1 pt-4">
          <XpChip />
        </div>
      </aside>

      {/* ===== Content ===== */}
      <div className="min-w-0 flex-1 pb-28 md:pb-8">
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </div>

      {/* ===== Mobile bottom tab bar ===== */}
      <nav className="fixed inset-x-0 bottom-0 z-40 md:hidden" aria-label="Main">
        <div
          className="rounded-t-[24px] bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
          style={{ boxShadow: "0 -8px 30px -12px rgba(120,100,200,0.25)" }}
        >
          <div className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">
            {PRIMARY_NAV.slice(0, 2).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  clsx(
                    "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold transition active:scale-95",
                    isActive ? "bg-peach text-tangerine" : "text-muted",
                  )
                }
              >
                <item.icon className="h-5 w-5" strokeWidth={2.5} />
                <span className="uppercase tracking-wide">{t(item.key)}</span>
              </NavLink>
            ))}

            {/* Central prominent Create */}
            <div className="flex flex-col items-center gap-1 pb-1">
              <button
                onClick={goCreate}
                aria-label={t("decks.newPack")}
                className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-glow transition active:scale-95"
                style={CREATE_GRADIENT}
              >
                <Plus className="h-7 w-7" strokeWidth={2.75} />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted">New</span>
            </div>

            <NavLink
              to="/review"
              className={({ isActive }) =>
                clsx(
                  "flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold transition active:scale-95",
                  isActive ? "bg-peach text-tangerine" : "text-muted",
                )
              }
            >
              <Star className="h-5 w-5" strokeWidth={2.5} />
              <span className="uppercase tracking-wide">{t("nav.practice")}</span>
            </NavLink>

            <button
              onClick={() => setMoreOpen(true)}
              className="flex flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-bold text-muted transition active:scale-95"
              aria-label="More"
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={2.5} />
              <span className="uppercase tracking-wide">More</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ===== More sheet ===== */}
      {moreOpen && (
        <Modal title="More" onClose={() => setMoreOpen(false)}>
          <div className="flex flex-col gap-1 pb-2">
            {MORE_NAV.map((item) => (
              <button
                key={item.to}
                onClick={() => {
                  setMoreOpen(false);
                  navigate(item.to);
                }}
                className="flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition active:scale-[0.98] hover:bg-mist"
              >
                <span className={clsx("flex h-11 w-11 items-center justify-center rounded-2xl", item.tint)}>
                  <item.icon className="h-5 w-5 text-ink" strokeWidth={2.25} />
                </span>
                <span className="flex-1 text-[15px] font-bold text-ink">{t(item.key)}</span>
                <ChevronRight className="h-5 w-5 text-muted" strokeWidth={2.5} />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
