import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import clsx from "clsx";
import { api, type Flashcard } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../components/ui";

const GRADES = [1, 2, 3, 4] as const;

export default function Review() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const dueQ = useQuery({ queryKey: ["due"], queryFn: () => api.get<Flashcard[]>("/flashcards/due") });

  useEffect(() => {
    if (dueQ.data && !loaded) {
      setQueue(dueQ.data);
      setLoaded(true);
    }
  }, [dueQ.data, loaded]);

  const gradeMut = useMutation({
    mutationFn: ({ cardId, grade }: { cardId: string; grade: number }) =>
      api.post(`/flashcards/review`, { cardId, grade }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["due"] }),
  });

  const gradeLabels: Record<number, string> = {
    1: t("review.again"),
    2: t("review.hard"),
    3: t("review.good"),
    4: t("review.easy"),
  };

  const handleGrade = (grade: number) => {
    const card = queue[index];
    if (!card) return;
    gradeMut.mutate({ cardId: card.id, grade });
    setReviewed((r) => r + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  if (dueQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (dueQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => dueQ.refetch()} retryLabel={t("common.retry")} />;

  const done = loaded && index >= queue.length;
  const card = queue[index];

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("review.title")} />

      {!loaded || queue.length === 0 ? (
        <EmptyState title={t("review.empty")} />
      ) : done ? (
        <Card className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="mt-3 text-xl font-bold">{t("review.done")}</h2>
          <p className="mt-1 text-slate-500">
            {reviewed} {t("review.reviewed")}
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setLoaded(false);
              setIndex(0);
              setReviewed(0);
              dueQ.refetch();
            }}
          >
            {t("btn.retry")}
          </Button>
        </Card>
      ) : (
        card && (
          <div>
            <p className="mb-3 text-center text-sm text-slate-500">
              {index + 1} {t("review.of")} {queue.length}
            </p>
            <Card className="min-h-[240px] cursor-pointer" >
              <div onClick={() => setFlipped((f) => !f)} className="flex min-h-[200px] flex-col items-center justify-center text-center">
                <p className="text-lg font-medium">{flipped ? card.back : card.front}</p>
                {!flipped && (
                  <Button variant="secondary" className="mt-6" onClick={(e) => { e.stopPropagation(); setFlipped(true); }}>
                    {t("btn.flip")}
                  </Button>
                )}
              </div>
            </Card>
            {flipped && (
              <div className="mt-4 grid grid-cols-4 gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    onClick={() => handleGrade(g)}
                    disabled={gradeMut.isPending}
                    className={clsx(
                      "rounded-xl border px-2 py-3 text-sm font-semibold transition disabled:opacity-50",
                      g === 1 && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
                      g === 2 && "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
                      g === 3 && "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                      g === 4 && "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
                    )}
                  >
                    {g}. {gradeLabels[g]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
