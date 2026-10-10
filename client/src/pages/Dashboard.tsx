import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Layers, Plus, RotateCcw, Sparkles, StickyNote, Timer, Zap } from "lucide-react";
import { api, type HeatmapDay, type TodayStats } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, TextInput } from "../components/ui";

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

  const color = (c: number) =>
    c === 0 ? "bg-slate-100" : c < 3 ? "bg-indigo-200" : c < 6 ? "bg-indigo-400" : "bg-indigo-600";

  return (
    <div className="flex gap-1 overflow-x-auto">
      {weeks.slice(-16).map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((cell, di) =>
            cell ? (
              <div
                key={di}
                title={`${cell.date}: ${cell.count}`}
                className={`h-3.5 w-3.5 rounded-sm ${color(cell.count)}`}
              />
            ) : (
              <div key={di} className="h-3.5 w-3.5" />
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
      <PageHeader
        title={t("dash.title")}
        action={
          <Link to="/decks" className="btn-primary">
            <Plus className="h-4 w-4" />
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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <RotateCcw className="h-4 w-4" />
                {t("dash.due")}
              </div>
              <p className="mt-1 text-3xl font-bold">{stats.dueCount}</p>
              <Link to="/review" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">
                {t("dash.startReview")} →
              </Link>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Layers className="h-4 w-4" />
                {t("dash.decks")}
              </div>
              <p className="mt-1 text-3xl font-bold">{stats.decksCount}</p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Timer className="h-4 w-4" />
                {t("dash.focus")}
              </div>
              <p className="mt-1 text-3xl font-bold">
                {stats.focusMinutesToday}
                <span className="ml-1 text-base font-medium text-slate-400">{t("dash.min")}</span>
              </p>
            </Card>
            <Card>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Zap className="h-4 w-4" />
                {t("dash.xp")}
              </div>
              <p className="mt-1 text-3xl font-bold">{stats.xpToday}</p>
            </Card>
          </div>
        )
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">{t("dash.heatmap")}</h2>
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

        <Card>
          <h2 className="mb-3 font-semibold">{t("dash.quick")}</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/review" className="btn-secondary">
              <RotateCcw className="h-4 w-4" />
              {t("dash.startReview")}
            </Link>
            <Link to="/explain" className="btn-secondary">
              <Sparkles className="h-4 w-4" />
              {t("nav.explain")}
            </Link>
            <Link to="/notes" className="btn-secondary">
              <StickyNote className="h-4 w-4" />
              {t("nav.notes")}
            </Link>
            <Link to="/chat" className="btn-secondary">
              <Zap className="h-4 w-4" />
              {t("nav.chat")}
            </Link>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium">{t("dash.logFocus")}</p>
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
                variant="secondary"
                disabled={focusMut.isPending}
                onClick={() => {
                  const m = parseInt(minutes, 10);
                  if (Number.isFinite(m) && m > 0) focusMut.mutate(m);
                }}
              >
                {focusMut.isPending ? t("common.loading") : t("btn.save")}
              </Button>
            </div>
            {focusMut.isSuccess && <p className="mt-2 text-sm text-green-600">+{focusMut.data.xp} XP</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
