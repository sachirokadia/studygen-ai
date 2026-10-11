import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api, type TodayStats } from "../lib/api";
import { useLang } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState, PageBg } from "../components/ui";
import { YellowChick } from "../components/creatures";
import DemoBanner from "../components/DemoBanner";

export default function Dashboard() {
  const { t } = useLang();
  const todayQ = useQuery({ queryKey: ["today"], queryFn: () => api.get<TodayStats>("/study/today") });

  const due = todayQ.data?.dueCount ?? 0;
  // One big action: practice if there are cards, otherwise go make some.
  const studyTarget = due > 0 ? "/review" : "/decks";

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

          <Link to={studyTarget} className="btn-green mt-8 inline-flex !px-12 !py-5 !text-3xl">
            {t("home.studyNow")}
          </Link>

          <div className="mt-4">
            <Link to="/decks" className="btn-yellow btn-sm">
              <Plus className="h-4 w-4" strokeWidth={2.75} />
              {t("home.makeNew")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
