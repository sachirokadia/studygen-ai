import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bookmark, Coins, Layers, Lightbulb, Map, MessageCircle, Plus, Sparkles, Star, StickyNote, Target, Timer, Wrench } from "lucide-react";
import clsx from "clsx";
import { api, type Deck, type TodayStats } from "../lib/api";
import { useLang, type I18nKey, type Lang } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState, PageBg, Pill } from "../components/ui";
import { YellowChick } from "../components/creatures";
import Creature, { type CreatureKind } from "../components/creatures";
import DemoBanner from "../components/DemoBanner";

interface Recommendation {
  type: string;
  title: string;
  reason: string;
  link: string;
}

const REC_ICONS: Record<string, typeof Star> = {
  review: Star,
  "weak-deck": Target,
  focus: Timer,
  start: Plus,
};

function recText(type: string, t: (k: I18nKey) => string, due: number): string {
  if (type === "review") return due > 0 ? `${due} ${t("rec.practiceN")}` : t("rec.review");
  if (type === "weak-deck") return t("rec.weak");
  if (type === "focus") return t("rec.focus");
  return t("rec.start");
}

/** This week's 7 day dots. Today is highlighted — the other dots are just
 *  the calendar, they don't claim any activity (no streak data from the API). */
function WeekStrip({ lang }: { lang: Lang }) {
  const today = new Date();
  const monday = new Date(today);
  const day = (today.getDay() + 6) % 7; // Monday-first
  monday.setDate(today.getDate() - day);
  const locale = lang === "hi" ? "hi-IN" : "en-US";
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2" aria-label="This week">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const isToday = d.toDateString() === today.toDateString();
        const name = d.toLocaleDateString(locale, { weekday: "narrow" });
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className={clsx("week-dot", isToday && "week-dot-today")} aria-current={isToday ? "date" : undefined}>
              {d.getDate()}
            </span>
            <span className={clsx("font-display text-xs font-extrabold", isToday ? "text-ink" : "text-ink/40")}>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const TILE_COLORS = ["bg-blush", "bg-butter", "bg-mint", "bg-lav"];
const DECK_TINTS = ["bg-blush", "bg-ice", "bg-butter", "bg-mint", "bg-lav", "bg-peach"];
const DECK_CREATURES: CreatureKind[] = ["chick", "dog", "orange", "grey"];

export default function Dashboard() {
  const { t, lang } = useLang();
  const todayQ = useQuery({ queryKey: ["today"], queryFn: () => api.get<TodayStats>("/study/today") });
  const decksQ = useQuery({ queryKey: ["decks"], queryFn: () => api.get<Deck[]>("/decks") });
  const recsQ = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.get<{ recommendations: Recommendation[] }>("/study/recommendations"),
  });

  const due = todayQ.data?.dueCount ?? 0;
  const decksCount = todayQ.data?.decksCount ?? 0;
  const xp = todayQ.data?.xpToday ?? 0;
  const focusMin = todayQ.data?.focusMinutesToday ?? 0;
  const decks = (decksQ.data ?? []).slice(0, 4);
  const recs = (recsQ.data?.recommendations ?? []).slice(0, 3);
  // Fix 5: brand-new users see a first-run CTA, not "All done!".

  const tiles = [
    { value: due, label: t("home.cardsToPractice"), icon: Layers, circle: "bg-playblue", tint: TILE_COLORS[0]! },
    { value: xp, label: t("nav.coins"), icon: Coins, circle: "bg-playorange", tint: TILE_COLORS[1]! },
    { value: focusMin, label: t("focus.minutes"), icon: Timer, circle: "bg-playgreen", tint: TILE_COLORS[2]! },
    { value: decksCount, label: t("decks.title"), icon: Star, circle: "bg-playpurple", tint: TILE_COLORS[3]! },
  ];

  return (
    <div>
      <PageBg variant="sky" />
      <DemoBanner />

      {todayQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : todayQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => todayQ.refetch()} retryLabel={t("common.retry")} />
      ) : (
        <div className="mx-auto max-w-xl">
          {/* ===== Greeting ===== */}
          <div className="flex items-center justify-center gap-3 text-center">
            <YellowChick size={88} className="animate-bob" />
            <h1 className="title-chunky">{t("home.greeting")}</h1>
          </div>

          {/* ===== Week strip ===== */}
          <div className="mt-5">
            <WeekStrip lang={lang} />
          </div>

          {/* ===== Daily check-in tiles ===== */}
          <p className="mb-3 mt-8 text-center font-display text-xl font-extrabold text-ink/70">
            {t("home.checkin")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className={clsx("stat-tile p-4", tile.tint)}>
                <span className={clsx("flex h-10 w-10 items-center justify-center rounded-full text-white", tile.circle)}>
                  <tile.icon className="h-5 w-5" strokeWidth={2.75} />
                </span>
                <p className="mt-2 font-display text-3xl font-extrabold leading-none">{tile.value}</p>
                <p className="mt-1 font-display text-sm font-extrabold text-ink/60">{tile.label}</p>
              </div>
            ))}
          </div>

          {/* ===== Hero CTA ===== */}
          {due > 0 ? (
            <div className="paper-card animate-pop-in mt-6 p-6 text-center">
              <p className="font-display text-7xl font-extrabold text-ink">{due}</p>
              <p className="mt-1 font-display text-xl font-extrabold text-ink/60">
                {t("home.cardsToPractice")}
              </p>
              <Link to="/review" className="btn-gradient mt-5 inline-flex !px-12 !py-4 !text-2xl">
                {t("home.studyNow")}
              </Link>
              <div className="mt-3">
                <Link to="/decks" className="btn-yellow btn-sm">
                  <Plus className="h-4 w-4" strokeWidth={2.75} />
                  {t("home.makeNew")}
                </Link>
              </div>
            </div>
          ) : decksCount === 0 ? (
            <div className="mt-6">
              <EmptyState
                title={t("home.firstPack")}
                creature="chick"
                action={
                  <Link to="/decks" className="btn-gradient inline-flex !px-10 !py-4 !text-2xl">
                    {t("home.makeFirst")}
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="paper-card mt-6 p-6 text-center">
              <p className="font-display text-3xl font-extrabold">{t("home.allDone")}</p>
              <Link to="/decks" className="btn-green mt-4 inline-flex !px-10 !py-4 !text-2xl">
                {t("home.makeNew")}
              </Link>
            </div>
          )}

          {/* ===== My packs ===== */}
          {decks.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-display text-xl font-extrabold text-ink/70">{t("decks.title")}</p>
                <Link to="/decks" className="font-display text-sm font-extrabold text-playpurple">
                  →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {decks.map((deck, i) => (
                  <Link
                    key={deck.id}
                    to={`/decks/${deck.id}`}
                    className={clsx("stat-tile block p-4", DECK_TINTS[i % DECK_TINTS.length])}
                  >
                    <div className="flex justify-center">
                      <Creature kind={DECK_CREATURES[i % DECK_CREATURES.length]!} size={56} className="animate-bob" />
                    </div>
                    <h3 className="mt-1 truncate text-center font-display text-base font-extrabold leading-tight">
                      {deck.title}
                    </h3>
                    <div className="mt-2 flex justify-center">
                      <Pill className="!bg-white/80 !text-xs">
                        {deck.cardCount} {t("decks.cards")}
                      </Pill>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Fix 8: Tools — Notes, Paths, Ask AI, Chat, Focus, Saved — visible on the Dashboard. */}
          <div className="mt-10">
            <p className="mb-3 flex items-center justify-center gap-2 font-display text-xl font-extrabold text-ink/70">
              <Wrench className="h-5 w-5" strokeWidth={2.75} />
              {t("home.tools")}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { to: "/notes", label: t("nav.notes"), icon: StickyNote, circle: "bg-playpink", tint: "bg-blush" },
                { to: "/paths", label: t("nav.paths"), icon: Map, circle: "bg-playpurple", tint: "bg-lav" },
                { to: "/explain", label: t("nav.explain"), icon: Sparkles, circle: "bg-playyellow", tint: "bg-butter" },
                { to: "/chat", label: t("nav.chat"), icon: MessageCircle, circle: "bg-playgreen", tint: "bg-mint" },
                { to: "/focus", label: t("me.focus"), icon: Timer, circle: "bg-playblue", tint: "bg-ice" },
                { to: "/bookmarks", label: t("nav.bookmarks"), icon: Bookmark, circle: "bg-playorange", tint: "bg-peach" },
              ].map((tool) => (
                <Link
                  key={tool.to}
                  to={tool.to}
                  className={clsx("stat-tile flex flex-col items-center gap-1.5 p-3.5 text-center transition active:scale-95", tool.tint)}
                >
                  <span className={clsx("flex h-11 w-11 items-center justify-center rounded-full text-white", tool.circle)}>
                    <tool.icon className="h-5 w-5" strokeWidth={2.75} />
                  </span>
                  <span className="font-display text-sm font-extrabold leading-tight">{tool.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {recs.length > 0 && (
            <div className="mt-10">
              <p className="mb-3 flex items-center justify-center gap-2 font-display text-xl font-extrabold text-ink/70">
                <Lightbulb className="h-5 w-5" strokeWidth={2.75} />
                {t("home.tips")}
              </p>
              <div className="space-y-2.5">
                {recs.map((r, i) => {
                  const Icon = REC_ICONS[r.type] ?? Star;
                  return (
                    <Link
                      key={`${r.type}-${i}`}
                      to={r.link}
                      className="paper-card flex items-center gap-3 !p-4 text-left transition active:scale-[0.98]"
                    >
                      <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white", ["bg-playpink", "bg-playpurple", "bg-playblue"][i % 3])}>
                        <Icon className="h-5 w-5" strokeWidth={2.75} />
                      </span>
                      <span className="font-display text-lg font-extrabold leading-tight">
                        {recText(r.type, t, due)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
