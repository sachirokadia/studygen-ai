import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, Trash2 } from "lucide-react";
import { api, type Bookmark as BookmarkType } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../components/ui";

export default function Bookmarks() {
  const { t } = useLang();
  const queryClient = useQueryClient();

  const bmQ = useQuery({ queryKey: ["bookmarks"], queryFn: () => api.get<BookmarkType[]>("/bookmarks") });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/bookmarks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("bookmarks.title")} />

      {bmQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : bmQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => bmQ.refetch()} retryLabel={t("common.retry")} />
      ) : bmQ.data && bmQ.data.length > 0 ? (
        <div className="space-y-2">
          {bmQ.data.map((b) => (
            <Card key={b.id} className="!p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Bookmark className="h-5 w-5 text-indigo-500" />
                  <div>
                    <p className="font-medium">{b.label}</p>
                    <p className="text-xs text-slate-400">
                      {b.kind} · {new Date(b.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate(b.id);
                  }}
                  disabled={deleteMut.isPending}
                  className="!px-3 !py-1.5 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={t("bookmarks.empty")} />
      )}
    </div>
  );
}
