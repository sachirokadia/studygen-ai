import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Lightbulb, Plus, Star, Target, Timer } from "lucide-react";
import { api, type TodayStats } from "../lib/api";
import { useLang, type I18nKey } from "../lib/i18n";
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

export default function Dashboard() {
  const { t } = useLang();
  const todayQ = useQuery({ queryKey: ["today"], queryFn: () => api.get<TodayStats>("/study/today") });
  const recsQ = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.get<{ recommendations: Recommendation[] }>("/study/recommendations"),
  });

  const due = todayQ.data?.dueCount ?? 0;
  const recs = (recsQ.data?.recommendations ?? []).slice(0, 3);

  return (
    <div>
      <PageBg variant="sky" />
      <DemoBanner />

      {todayQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : todayQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => todayQ.refetch()} retryLabel={t("common.retry")} />
      ) : (
        <div className="mx-auto max-w-xl text-center">
          <YellowChick size={128} className="mx-auto animate-bob" />
          <h1 className="title-chunky mt-2">{t("home.greeting")}</h1>

          {due > 0 ? (
            <>
              <p className="mt-6 font-display text-7xl font-extrabold">{due}</p>
              <p className="mt-1 font-display text-2xl font-extrabold uppercase text-ink/60">
                {t("home.cardsToPractice")}
              </p>
            </>
          ) : (
            <EmptyState title={t("home.allDone")} creature="dog" />
          )}

          {due > 0 ? (
            <Link to="/review" className="btn-green mt-8 inline-flex !px-12 !py-5 !text-3xl">
              {t("home.studyNow")}
            </Link>
          ) : (
            <Link to="/decks" className="btn-green mt-8 inline-flex !px-12 !py-5 !text-3xl">
              {t("home.makeNew")}
            </Link>
          )}

          {due > 0 && (
            <div className="mt-4">
              <Link to="/decks" className="btn-yellow btn-sm">
                <Plus className="h-4 w-4" strokeWidth={2.75} />
                {t("home.makeNew")}
              </Link>
            </div>
          )}

          {recs.length > 0 && (
            <div className="mt-10 text-left">
              <p className="mb-3 flex items-center justify-center gap-2 font-display text-xl font-extrabold uppercase text-ink/60">
                <Lightbulb className="h-5 w-5" strokeWidth={2.75} />
                {t("home.tips")}
              </p>
              <div className="space-y-2">
                {recs.map((r, i) => {
                  const Icon = REC_ICONS[r.type] ?? Star;
                  return (
                    <Link
                      key={`${r.type}-${i}`}
                      to={r.link}
                      className="paper-card flex items-center gap-3 !p-3 text-left transition-transform hover:-rotate-1"
                    >
                      <span className="pill !p-2">
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
