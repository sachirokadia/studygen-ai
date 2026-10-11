import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layers, Plus, RotateCcw, Sparkles, StickyNote, Timer, Zap } from "lucide-react";
import { api, type HeatmapDay, type TodayStats } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, HangTag, LoadingState, PageBg, PageHeader, Pill, TextInput } from "../components/ui";
import { GreyBlob, OrangeBlob, YellowChick, SpottedDog } from "../components/creatures";
import DemoBanner from "../components/DemoBanner";

function Heatmap({ days }: { days: HeatmapDay[] }) {
  // Build a 16-week (112-day) grid ending today.
  const counts = new Map(days.map((d) => [d.date.slice(0, 10), d.count]));
  const today = new Date();
  const cells: { date: string; count: number }[] = [];
  for (let i = 111; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    cells.push({ date: key, count: counts.get(key) ?? 0 });
  }
  // Offset so the first column starts on Monday.
  const firstDow = (new Date(cells[0]!.date).getDay() + 6) % 7;
  const padded: ({ date: string; count: number } | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...cells,
  ];
  const weeks: ({ date: string; count: number } | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));

  // Garden-plot shades: empty soil -> sprouting -> growing -> full bloom.
  const color = (c: number) =>
    c === 0 ? "bg-paperdark" : c < 3 ? "bg-grass/30" : c < 6 ? "bg-grass/60" : "bg-grassdark";

  return (
    <div className="flex gap-1 overflow-x-auto">
      {weeks.slice(-16).map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((cell, di) =>
            cell ? (
              <div
                key={di}
                title={`${cell.date}: ${cell.count}`}
                className={`h-4 w-4 rounded border-2 border-ink/25 ${color(cell.count)}`}
              />
            ) : (
              <div key={di} className="h-4 w-4" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState("25");

  const todayQ = useQuery({ queryKey: ["today"], queryFn: () => api.get<TodayStats>("/study/today") });
  const heatQ = useQuery({ queryKey: ["heatmap"], queryFn: () => api.get<HeatmapDay[]>("/study/heatmap") });

  const focusMut = useMutation({
    mutationFn: (mins: number) => api.post<{ xp: number }>("/study/focus", { minutes: mins }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today"] });
      queryClient.invalidateQueries({ queryKey: ["heatmap"] });
    },
  });

  const stats = todayQ.data;

  return (
    <div>
      <PageBg variant="sky" />
      <DemoBanner />
      <PageHeader
        title="MY YARD"
        action={
          <Link to="/decks" className="btn-yellow btn-sm">
            <Plus className="h-4 w-4" strokeWidth={2.75} />
            {t("dash.newDeck")}
          </Link>
        }
      />

      {todayQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : todayQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => todayQ.refetch()} retryLabel={t("common.retry")} />
      ) : (
        stats && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Pill>
                {stats.decksCount} {t("dash.decks")}
              </Pill>
              <Pill color="bg-btnblue">
                {stats.dueCount} {t("dash.due")}
              </Pill>
            </div>

            <div className="mb-6 flex items-end justify-center gap-4 md:gap-8">
              <GreyBlob size={72} className="animate-bob" />
              <OrangeBlob size={88} className="animate-bob" />
              <YellowChick size={80} className="animate-bob" />
              <SpottedDog size={96} className="animate-bob" />
            </div>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card alt>
                <HangTag color="bg-btnpink" className="!text-base">
                  <RotateCcw className="h-4 w-4" strokeWidth={2.75} />
                  {t("dash.due")}
                </HangTag>
                <p className="mt-3 font-display text-5xl font-extrabold">{stats.dueCount}</p>
                <Link to="/review" className="btn-blue btn-sm mt-3">
                  {t("dash.startReview")} →
                </Link>
              </Card>
              <Card>
                <HangTag color="bg-btnblue" className="!text-base">
                  <Layers className="h-4 w-4" strokeWidth={2.75} />
                  {t("dash.decks")}
                </HangTag>
                <p className="mt-3 font-display text-5xl font-extrabold">{stats.decksCount}</p>
                <Link to="/decks" className="btn-yellow btn-sm mt-3">
                  {t("nav.yard")} →
                </Link>
              </Card>
              <Card alt>
                <HangTag color="bg-machinepurple" className="!text-base">
                  <Timer className="h-4 w-4" strokeWidth={2.75} />
                  {t("dash.focus")}
                </HangTag>
                <p className="mt-3 font-display text-5xl font-extrabold">
                  {stats.focusMinutesToday}
                  <span className="ml-1 font-body text-base font-bold text-ink/50">{t("dash.min")}</span>
                </p>
                <a href="#focus-logger" className="btn-green btn-sm mt-3">
                  {t("dash.logFocus")} →
                </a>
              </Card>
              <Card>
                <HangTag color="bg-btnyellow" className="!text-base">
                  <Zap className="h-4 w-4" strokeWidth={2.75} />
                  {t("dash.xp")}
                </HangTag>
                <p className="mt-3 font-display text-5xl font-extrabold">{stats.xpToday}</p>
                <Link to="/paths" className="btn-pink btn-sm mt-3">
                  {t("nav.paths")} →
                </Link>
              </Card>
            </div>
          </>
        )
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display text-2xl font-extrabold uppercase">{t("dash.heatmap")}</h2>
          {heatQ.isLoading ? (
            <LoadingState />
          ) : heatQ.isError ? (
            <ErrorState message={t("common.error")} onRetry={() => heatQ.refetch()} retryLabel={t("common.retry")} />
          ) : heatQ.data && heatQ.data.length > 0 ? (
            <Heatmap days={heatQ.data} />
          ) : (
            <EmptyState title={t("common.empty")} />
          )}
        </Card>

        <Card className="washi relative">
          <h2 className="mb-3 font-display text-2xl font-extrabold uppercase">{t("dash.quick")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/review" className="btn-green">
              <RotateCcw className="h-4 w-4" strokeWidth={2.75} />
              {t("dash.startReview")}
            </Link>
            <Link to="/explain" className="btn-blue">
              <Sparkles className="h-4 w-4" strokeWidth={2.75} />
              {t("nav.explain")}
            </Link>
            <Link to="/notes" className="btn-yellow">
              <StickyNote className="h-4 w-4" strokeWidth={2.75} />
              {t("nav.notes")}
            </Link>
            <Link to="/chat" className="btn-pink">
              <Zap className="h-4 w-4" strokeWidth={2.75} />
              {t("nav.chat")}
            </Link>
          </div>
          <div id="focus-logger" className="mt-4 border-t-[3px] border-dashed border-ink/20 pt-4">
            <p className="mb-2 font-display text-xl font-extrabold uppercase">{t("dash.logFocus")}</p>
            <div className="flex gap-2">
              <TextInput
                type="number"
                min={1}
                max={240}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className="w-28"
                placeholder={t("dash.minutes")}
              />
              <Button
                variant="cream"
                disabled={focusMut.isPending}
                onClick={() => {
                  const m = parseInt(minutes, 10);
                  if (Number.isFinite(m) && m > 0) focusMut.mutate(m);
                }}
              >
                {focusMut.isPending ? t("common.loading") : t("btn.save")}
              </Button>
            </div>
            {focusMut.isSuccess && <p className="mt-2 font-display text-2xl font-extrabold text-grassdark">+{focusMut.data.xp} XP</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
