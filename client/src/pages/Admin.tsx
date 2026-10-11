import { useQuery } from "@tanstack/react-query";
import { Layers, StickyNote, Users } from "lucide-react";
import { api, type AdminStats } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState, PageBg, Pill } from "../components/ui";

export default function Admin() {
  const { t } = useLang();
  const { user } = useAuth();

  const statsQ = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") {
    return (
      <div>
        <PageBg variant="night" />
        <div className="board-cream mx-auto max-w-5xl p-4 md:p-6">
          <h1 className="title-chunky">{t("admin.title")}</h1>
          <EmptyState title={t("admin.forbidden")} creature="grey" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageBg variant="night" />
      <div className="board-cream mx-auto max-w-5xl p-4 md:p-6">
        <h1 className="title-chunky mb-6">{t("admin.title")}</h1>
        {statsQ.isLoading ? (
          <LoadingState label={t("common.loading")} />
        ) : statsQ.isError ? (
          <ErrorState message={t("common.error")} onRetry={() => statsQ.refetch()} retryLabel={t("common.retry")} />
        ) : statsQ.data ? (
          <div className="flex flex-wrap gap-3">
            <Pill color="bg-btnyellow" className="!py-1.5 !text-lg">
              <Users className="h-5 w-5" strokeWidth={2.75} />
              {t("admin.users")}: {statsQ.data.users}
            </Pill>
            <Pill color="bg-sky" className="!py-1.5 !text-lg">
              <Layers className="h-5 w-5" strokeWidth={2.75} />
              {t("admin.decksCount")}: {statsQ.data.decks}
            </Pill>
            <Pill color="bg-btnpink" className="!py-1.5 !text-lg">
              <StickyNote className="h-5 w-5" strokeWidth={2.75} />
              {t("admin.cardsCount")}: {statsQ.data.cards}
            </Pill>
          </div>
        ) : (
          <EmptyState title={t("common.empty")} />
        )}
      </div>
    </div>
  );
}
