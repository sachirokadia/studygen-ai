import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, ShieldCheck, StickyNote, Users } from "lucide-react";
import { api, type AdminStats, type AdminUser } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg, Pill } from "../components/ui";

export default function Admin() {
  const { t } = useLang();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const statsQ = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => api.get<AdminStats>("/admin/stats"),
    enabled: user?.role === "admin",
  });

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.get<AdminUser[]>("/admin/users"),
    enabled: user?.role === "admin",
  });

  const roleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "admin" | "user" }) =>
      api.patch<AdminUser>(`/admin/users/${id}`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
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
          <>
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

            <h2 className="mb-3 mt-8 font-display text-2xl font-extrabold uppercase">
              {t("admin.userList")}
            </h2>
            {usersQ.isLoading ? (
              <LoadingState label={t("common.loading")} />
            ) : usersQ.isError ? (
              <ErrorState
                message={t("common.error")}
                onRetry={() => usersQ.refetch()}
                retryLabel={t("common.retry")}
              />
            ) : (
              <div className="space-y-2">
                {(usersQ.data ?? []).map((u) => {
                  const isSelf = u.id === user?.id;
                  const isAdmin = u.role === "admin";
                  return (
                    <div
                      key={u.id}
                      className="paper-card flex flex-wrap items-center gap-3 !p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-lg font-extrabold leading-tight">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 font-body text-xs font-bold text-ink/50">
                              ({t("admin.you")})
                            </span>
                          )}
                        </p>
                        <p className="truncate font-body text-xs font-bold text-ink/60">{u.email}</p>
                      </div>
                      <Pill color={isAdmin ? "bg-btnyellow" : "bg-paper"} className="!text-xs">
                        <ShieldCheck className="h-4 w-4" strokeWidth={2.75} />
                        {u.role}
                      </Pill>
                      {!isSelf && (
                        <Button
                          variant={isAdmin ? "cream" : "yellow"}
                          className="btn-sm"
                          disabled={roleMut.isPending}
                          onClick={() =>
                            roleMut.mutate({ id: u.id, role: isAdmin ? "user" : "admin" })
                          }
                        >
                          {isAdmin ? t("admin.removeAdmin") : t("admin.makeAdmin")}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <EmptyState title={t("common.empty")} />
        )}
      </div>
    </div>
  );
}
