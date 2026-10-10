import { useQuery } from "@tanstack/react-query";
import { Layers, StickyNote, Users } from "lucide-react";
import { api, type AdminStats } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../components/ui";

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
        <PageHeader title={t("admin.title")} />
        <EmptyState title={t("admin.forbidden")} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("admin.title")} />
      {statsQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : statsQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => statsQ.refetch()} retryLabel={t("common.retry")} />
      ) : statsQ.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Users className="h-4 w-4" />
              {t("admin.users")}
            </div>
            <p className="mt-1 text-3xl font-bold">{statsQ.data.users}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Layers className="h-4 w-4" />
              {t("admin.decksCount")}
            </div>
            <p className="mt-1 text-3xl font-bold">{statsQ.data.decks}</p>
          </Card>
          <Card>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <StickyNote className="h-4 w-4" />
              {t("admin.cardsCount")}
            </div>
            <p className="mt-1 text-3xl font-bold">{statsQ.data.cards}</p>
          </Card>
        </div>
      ) : (
        <EmptyState title={t("common.empty")} />
      )}
    </div>
  );
}
