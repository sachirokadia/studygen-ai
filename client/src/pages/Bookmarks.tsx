import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bookmark, Trash2 } from "lucide-react";
import { api, type Bookmark as BookmarkType } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg, PageHeader } from "../components/ui";

export default function Bookmarks() {
  const { t } = useLang();
  const queryClient = useQueryClient();

  const bmQ = useQuery({ queryKey: ["bookmarks"], queryFn: () => api.get<BookmarkType[]>("/bookmarks") });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/bookmarks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  return (
    <div>
      <PageBg variant="sky" />
      <PageHeader title={t("nav.bookmarks")} />

      {bmQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : bmQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => bmQ.refetch()} retryLabel={t("common.retry")} />
      ) : bmQ.data && bmQ.data.length > 0 ? (
        <div className="board-brown p-4 md:p-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {bmQ.data.map((b) => (
              <div key={b.id} className="paper-card relative p-4">
                <div className="flex items-center gap-2">
                  <Bookmark className="h-5 w-5 shrink-0" strokeWidth={2.75} />
                  <p className="truncate font-display text-lg font-extrabold uppercase leading-tight">{b.label}</p>
                </div>
                <p className="mt-1 font-body text-xs font-bold text-ink/50">
                  {b.kind} · {new Date(b.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/review" className="btn-blue btn-sm">
                    REVIEW
                  </Link>
                  <Button
                    variant="pink"
                    className="btn-sm"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate(b.id);
                    }}
                    aria-label="Delete bookmark"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.75} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title={t("bookmarks.empty")} />
      )}
    </div>
  );
}
