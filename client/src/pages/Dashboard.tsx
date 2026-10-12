import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bookmark, Coins, Layers, Lightbulb, Map, MessageCircle, Plus, Sparkles, Star, StickyNote, Target, Timer, Wrench } from "lucide-react";
import clsx from "clsx";
import { api, type Deck, type TodayStats } from "../lib/api";
import { useLang, type I18nKey, type Lang } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState, PageBg } from "../components/ui";
import { YellowChick } from "../components/creatures";
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

/** This week's 7 day cells. Today is highlighted — the other cells are just
 *  the calendar, they don't claim any activity (no streak data from the API). */
function WeekStrip({ lang }: { lang: Lang }) {
  const today = new Date();
  const monday = new Date(today);
  const day = (today.getDay() + 6) % 7; // Monday-first
  monday.setDate(today.getDate() - day);
  const locale = lang === "hi" ? "hi-IN" : "en-US";
  return (
    <div className="day-strip justify-center" aria-label="This week">
      {Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const isToday = d.toDateString() === today.toDateString();
        const name = d.toLocaleDateString(locale, { weekday: "narrow" });
        return (
          <div key={i} className={clsx("day-cell", isToday && "day-cell-active")} aria-current={isToday ? "date" : undefined}>
            <span className={clsx("text-[11px] font-bold", isToday ? "text-white/90" : "text-muted")}>
              {name}
            </span>
            <span className={clsx("text-sm font-extrabold", isToday ? "text-white" : "text-ink")}>
              {d.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const TILE_TINTS = ["bg-sky", "bg-peach", "bg-lavender", "bg-mint"];
const ROW_TINTS: [string, string][] = [
  ["bg-peach", "text-tangerine"],
  ["bg-lavender", "text-lilac"],
  ["bg-sky", "text-skyblue"],
  ["bg-mint", "text-berry"],
];

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
    { value: due, label: t("home.cardsToPractice"), icon: Layers, circle: "bg-skyblue", tint: TILE_TINTS[0]! },
    { value: xp, label: t("nav.coins"), icon: Coins, circle: "bg-tangerine", tint: TILE_TINTS[1]! },
    { value: focusMin, label: t("focus.minutes"), icon: Timer, circle: "bg-lilac", tint: TILE_TINTS[2]! },
    { value: decksCount, label: t("decks.title"), icon: Star, circle: "bg-pinkpop", tint: TILE_TINTS[3]! },
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
            <YellowChick size={88} className="animate-float" />
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink md:text-4xl">
              {t("home.greeting")}
            </h1>
          </div>

          {/* ===== Week strip ===== */}
          <div className="mt-5">
            <WeekStrip lang={lang} />
          </div>

          {/* ===== Daily check-in tiles ===== */}
          <p className="mb-3 mt-8 text-center text-xl font-extrabold text-muted">
            {t("home.checkin")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {tiles.map((tile) => (
              <div key={tile.label} className={clsx("stat-tile p-4", tile.tint)}>
                <span className={clsx("flex h-10 w-10 items-center justify-center rounded-full text-white", tile.circle)}>
                  <tile.icon className="h-5 w-5" strokeWidth={2.75} />
                </span>
                <p className="mt-2 text-3xl font-extrabold leading-none text-ink">{tile.value}</p>
                <p className="mt-1 text-sm font-bold text-muted">{tile.label}</p>
              </div>
            ))}
          </div>

          {/* ===== Hero CTA ===== */}
          {due > 0 ? (
            <div className="card animate-fade-up mt-6 p-6 text-center">
              <p className="text-7xl font-extrabold text-ink">{due}</p>
              <p className="mt-1 text-xl font-extrabold text-muted">
                {t("home.cardsToPractice")}
              </p>
              <Link to="/review" className="btn-primary mt-5 inline-flex !w-auto !px-12 !py-4 !text-2xl">
                {t("home.studyNow")}
              </Link>
              <div className="mt-3">
                <Link to="/decks" className="btn-soft btn-sm inline-flex">
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
                  <Link to="/decks" className="btn-primary inline-flex !w-auto !px-10 !py-4 !text-2xl">
                    {t("home.makeFirst")}
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="card mt-6 p-6 text-center">
              <p className="text-3xl font-extrabold text-ink">{t("home.allDone")}</p>
              <Link to="/decks" className="btn-primary mt-4 inline-flex !w-auto !px-10 !py-4 !text-xl">
                {t("home.makeNew")}
              </Link>
            </div>
          )}

          {/* ===== My packs ===== */}
          {decks.length > 0 && (
            <div className="mt-10">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xl font-extrabold text-muted">{t("decks.title")}</p>
                <Link to="/decks" className="text-sm font-extrabold text-lilac" aria-label={t("decks.title")}>
                  →
                </Link>
              </div>
              <div className="space-y-2.5">
                {decks.map((deck, i) => {
                  const [tint, fg] = ROW_TINTS[i % ROW_TINTS.length]!;
                  return (
                    <Link
                      key={deck.id}
                      to={`/decks/${deck.id}`}
                      className="card flex items-center gap-3 !rounded-3xl p-4 text-left transition active:scale-[0.98]"
                    >
                      <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl", tint, fg)}>
                        <Layers className="h-6 w-6" strokeWidth={2.5} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-extrabold leading-tight text-ink">
                          {deck.title}
                        </span>
                        <span className="mt-0.5 block text-sm font-bold text-muted">
                          {deck.cardCount} {t("decks.cards")}
                        </span>
                      </span>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist text-xl font-extrabold text-muted" aria-hidden="true">
                        →
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Fix 8: Tools — Notes, Paths, Ask AI, Chat, Focus, Saved — visible on the Dashboard. */}
          <div className="mt-10">
            <p className="mb-3 flex items-center justify-center gap-2 text-xl font-extrabold text-muted">
              <Wrench className="h-5 w-5" strokeWidth={2.75} />
              {t("home.tools")}
            </p>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { to: "/notes", label: t("nav.notes"), icon: StickyNote, tint: "bg-peach", fg: "text-tangerine" },
                { to: "/paths", label: t("nav.paths"), icon: Map, tint: "bg-lavender", fg: "text-lilac" },
                { to: "/explain", label: t("nav.explain"), icon: Sparkles, tint: "bg-sky", fg: "text-skyblue" },
                { to: "/chat", label: t("nav.chat"), icon: MessageCircle, tint: "bg-mint", fg: "text-berry" },
                { to: "/focus", label: t("me.focus"), icon: Timer, tint: "bg-peach", fg: "text-pinkpop" },
                { to: "/bookmarks", label: t("nav.bookmarks"), icon: Bookmark, tint: "bg-lavender", fg: "text-amber" },
              ].map((tool) => (
                <Link
                  key={tool.to}
                  to={tool.to}
                  className="card flex flex-col items-center gap-1.5 !rounded-3xl p-3.5 text-center transition active:scale-95"
                >
                  <span className={clsx("flex h-11 w-11 items-center justify-center rounded-2xl", tool.tint, tool.fg)}>
                    <tool.icon className="h-5 w-5" strokeWidth={2.75} />
                  </span>
                  <span className="text-sm font-extrabold leading-tight text-ink">{tool.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {recs.length > 0 && (
            <div className="mt-10">
              <p className="mb-3 flex items-center justify-center gap-2 text-xl font-extrabold text-muted">
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
                      className="card flex items-center gap-3 !rounded-3xl !p-4 text-left transition active:scale-[0.98]"
                    >
                      <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white", ["bg-pinkpop", "bg-lilac", "bg-skyblue"][i % 3])}>
                        <Icon className="h-5 w-5" strokeWidth={2.75} />
                      </span>
                      <span className="text-lg font-extrabold leading-tight text-ink">
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
