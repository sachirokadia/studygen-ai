import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Flashcard } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageBg, PageHeader, Pill } from "../components/ui";
import Creature, { type CreatureKind } from "../components/creatures";

const GRADES = [1, 2, 3, 4] as const;
const GRADE_VARIANTS = ["pink", "yellow", "blue", "green"] as const;

export default function Review() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [lastGrade, setLastGrade] = useState<number | null>(null);

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
    setLastGrade(grade);
    setReviewed((r) => r + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  if (dueQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (dueQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => dueQ.refetch()} retryLabel={t("common.retry")} />;

  const done = loaded && index >= queue.length;
  const card = queue[index];

  const mascot: CreatureKind =
    done || lastGrade === null ? (done ? "dog" : "chick") : lastGrade >= 3 ? "dog" : "grey";

  return (
    <div className="mx-auto max-w-2xl">
      <PageBg variant="sky" />
      <PageHeader title={t("review.title")} />

      {!loaded || queue.length === 0 ? (
        <EmptyState title={t("review.empty")} />
      ) : done ? (
        <Card className="washi relative text-center">
          <Creature kind="dog" size={104} className="mx-auto animate-bob" />
          <h2 className="mt-3 font-display text-4xl font-extrabold uppercase">{t("review.done")}</h2>
          <p className="mt-1 font-display text-2xl font-extrabold text-ink/60">
            {reviewed} {t("review.reviewed")}
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setLoaded(false);
              setIndex(0);
              setReviewed(0);
              setLastGrade(null);
              dueQ.refetch();
            }}
          >
            {t("btn.retry")}
          </Button>
        </Card>
      ) : (
        card && (
          <div>
            <div className="mb-4 flex items-center justify-center gap-4">
              <Creature kind={mascot} size={80} className="animate-bob" />
              <Pill color="bg-btnblue" className="!text-xl">
                {index + 1} {t("review.of")} {queue.length}
              </Pill>
            </div>
            <div
              onClick={() => setFlipped((f) => !f)}
              className="paper-card mx-auto max-w-2xl rotate-[1.5deg] cursor-pointer p-8 text-center"
            >
              <div className="flex min-h-[200px] flex-col items-center justify-center text-center">
                <p className="font-display text-3xl font-extrabold leading-snug">{flipped ? card.back : card.front}</p>
                {!flipped && (
                  <Button variant="secondary" className="mt-6" onClick={(e) => { e.stopPropagation(); setFlipped(true); }}>
                    {t("btn.flip")}
                  </Button>
                )}
              </div>
            </div>
            {flipped && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {GRADES.map((g, i) => (
                  <Button
                    key={g}
                    variant={GRADE_VARIANTS[i]}
                    onClick={() => handleGrade(g)}
                    disabled={gradeMut.isPending}
                  >
                    {g}. {gradeLabels[g]}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
