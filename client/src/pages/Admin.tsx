import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, ShieldCheck, StickyNote, Users } from "lucide-react";
import clsx from "clsx";
import { api, type AdminStats, type AdminUser } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg, PageHeader, Pill } from "../components/ui";

const AVATAR_BGS = ["bg-lavender", "bg-peach", "bg-mint", "bg-sky"];

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
        <div className="mx-auto max-w-5xl">
          <PageHeader title={t("admin.title")} />
          <EmptyState title={t("admin.forbidden")} creature="grey" />
        </div>
      </div>
    );
  }

  const stats = statsQ.data
    ? [
        { icon: Users, value: statsQ.data.users, label: t("admin.users"), bg: "bg-lavender" },
        { icon: Layers, value: statsQ.data.decks, label: t("admin.decksCount"), bg: "bg-sky" },
        { icon: StickyNote, value: statsQ.data.cards, label: t("admin.cardsCount"), bg: "bg-peach" },
      ]
    : [];

  return (
    <div>
      <PageBg variant="night" />
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t("admin.title")} />
        {statsQ.isLoading ? (
          <LoadingState label={t("common.loading")} />
        ) : statsQ.isError ? (
          <ErrorState message={t("common.error")} onRetry={() => statsQ.refetch()} retryLabel={t("common.retry")} />
        ) : statsQ.data ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="stat-tile flex items-center gap-3">
                  <span className={clsx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", s.bg)}>
                    <s.icon className="h-5 w-5 text-ink" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-2xl font-extrabold leading-none tracking-tight text-ink">{s.value}</p>
                    <p className="mt-1 truncate text-xs font-bold text-muted">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="mb-3 mt-8 text-xl font-extrabold tracking-tight text-ink">
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
                {(usersQ.data ?? []).map((u, idx) => {
                  const isSelf = u.id === user?.id;
                  const isAdmin = u.role === "admin";
                  const initials = (u.name || u.email || "?").trim().charAt(0).toUpperCase();
                  return (
                    <div
                      key={u.id}
                      className="card flex flex-wrap items-center gap-3 p-4"
                    >
                      <span
                        className={clsx(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-extrabold text-ink",
                          AVATAR_BGS[idx % AVATAR_BGS.length],
                        )}
                        aria-hidden="true"
                      >
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-extrabold leading-tight text-ink">
                          {u.name}
                          {isSelf && (
                            <span className="ml-2 text-xs font-bold text-muted">
                              ({t("admin.you")})
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs font-semibold text-muted">{u.email}</p>
                      </div>
                      <Pill color={isAdmin ? "bg-sun" : "bg-mist"}>
                        <ShieldCheck className="h-4 w-4" strokeWidth={2.75} />
                        {u.role}
                      </Pill>
                      {!isSelf && (
                        <Button
                          variant="soft"
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
