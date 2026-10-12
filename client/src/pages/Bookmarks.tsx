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

  const KIND_TINTS: Record<string, string> = {
    note: "bg-sky",
    flashcard: "bg-peach",
    deck: "bg-lavender",
    quiz: "bg-mint",
  };

  return (
    <div>
      <PageBg variant="sky" />
      <PageHeader title={t("nav.bookmarks")} />

      {bmQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : bmQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => bmQ.refetch()} retryLabel={t("common.retry")} />
      ) : bmQ.data && bmQ.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {bmQ.data.map((b) => (
            <div key={b.id} className="card relative flex items-center gap-4 p-4">
              <span
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] text-ink ${
                  KIND_TINTS[b.kind] ?? "bg-mist"
                }`}
              >
                <Bookmark className="h-6 w-6" strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold uppercase leading-tight tracking-tight text-ink">{b.label}</p>
                <p className="mt-0.5 text-xs font-bold text-ink/50">
                  {b.kind} · {new Date(b.createdAt).toLocaleDateString()}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <Link to="/review" className="btn-skyblue btn-sm">
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
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={t("bookmarks.empty")} creature="chick" />
      )}
    </div>
  );
}
