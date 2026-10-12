import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { api, type Flashcard } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg, PageHeader } from "../components/ui";
import Creature, { type CreatureKind } from "../components/creatures";
import { ClozeText, hasCloze, stripCloze } from "../lib/cloze";

// Two simple choices. NEED PRACTICE = grade 2, GOT IT! = grade 4.
export default function Review() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  // Fix 9: optional deckId scopes the review to one deck.
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get("deckId");
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [lastGotIt, setLastGotIt] = useState<boolean | null>(null);
  const [gradeError, setGradeError] = useState(false);

  const dueQ = useQuery({
    queryKey: ["due", deckId],
    queryFn: () => api.get<Flashcard[]>(deckId ? `/flashcards/due?deckId=${deckId}` : "/flashcards/due"),
  });

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

  const handleGrade = (gotIt: boolean) => {
    const card = queue[index];
    if (!card || gradeMut.isPending) return;
    setGradeError(false);
    gradeMut.mutate(
      { cardId: card.id, grade: gotIt ? 4 : 2 },
      {
        onSuccess: () => {
          setLastGotIt(gotIt);
          setReviewed((r) => r + 1);
          setFlipped(false);
          setIndex((i) => i + 1);
        },
        onError: () => setGradeError(true),
      },
    );
  };

  if (dueQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (dueQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => dueQ.refetch()} retryLabel={t("common.retry")} />;

  const done = loaded && index >= queue.length;
  const card = queue[index];

  // Creature reacts: happy when they got it, sleepy-encouraging when they need practice.
  const mascot: CreatureKind =
    done || lastGotIt === null ? (done ? "dog" : "chick") : lastGotIt ? "dog" : "grey";

  return (
    <div className="mx-auto max-w-2xl">
      <PageBg variant="sky" />
      <PageHeader title={t("review.title")} />

      {!loaded || queue.length === 0 ? (
        <EmptyState title={t("review.empty")} creature="dog" />
      ) : done ? (
        <div className="card animate-fade-up relative p-8 text-center">
          <Creature kind="dog" size={104} className="mx-auto animate-float" />
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">{t("review.allDone")}</h2>
          <p className="mt-1 text-2xl font-extrabold text-ink/60">
            {reviewed} {t("review.reviewed")}
          </p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => {
              setLoaded(false);
              setIndex(0);
              setReviewed(0);
              setLastGotIt(null);
              dueQ.refetch();
            }}
          >
            {t("btn.retry")}
          </Button>
        </div>
      ) : (
        card && (
          <div>
            <div className="mb-4 flex items-center justify-center gap-3">
              <Creature kind={mascot} size={64} className="animate-float" />
              <div className="min-w-[180px] flex-1 sm:max-w-xs">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-base font-extrabold text-ink/60">
                    {t("review.title")}
                  </span>
                  <span className="text-base font-extrabold text-ink">
                    {index + 1} {t("review.of")} {queue.length}
                  </span>
                </div>
                <div className="progress-track" role="progressbar" aria-valuenow={index + 1} aria-valuemax={queue.length}>
                  <div className="progress-fill" style={{ width: `${((index + 1) / queue.length) * 100}%` }} />
                </div>
              </div>
            </div>
            <div
              onClick={() => setFlipped((f) => !f)}
              className="card mx-auto max-w-2xl cursor-pointer !rounded-[28px] p-8 text-center"
            >
              <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                {!flipped ? (
                  <>
                    <p className="text-3xl font-extrabold leading-snug tracking-tight text-ink">
                      {hasCloze(card.front) ? (
                        <ClozeText text={card.front} revealed={false} />
                      ) : (
                        card.front
                      )}
                    </p>
                    <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-lavender px-4 py-1.5 text-sm font-bold text-ink/60">
                      <span aria-hidden="true">👆</span>
                      {t("review.tapToFlip")}
                    </p>
                  </>
                ) : (
                  <>
                    {hasCloze(card.front) && (
                      <p className="text-3xl font-extrabold leading-snug tracking-tight text-ink">
                        <ClozeText text={card.front} revealed={true} />
                      </p>
                    )}
                    <p className="mt-4 rounded-2xl bg-mint px-5 py-3 text-xl font-bold text-ink/80">
                      {stripCloze(card.back)}
                    </p>
                  </>
                )}
              </div>
            </div>
            {flipped && (
              <div className="mt-5 grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleGrade(false)}
                  disabled={gradeMut.isPending}
                  className="btn-berry !py-5 !text-2xl"
                >
                  {t("review.needPractice")}
                </button>
                <button
                  onClick={() => handleGrade(true)}
                  disabled={gradeMut.isPending}
                  className="btn-accent !py-5 !text-2xl"
                >
                  {t("review.gotIt")}
                </button>
              </div>
            )}
            {gradeError && (
              <div className="card mt-4 !bg-berry/10 p-4 text-center">
                <p className="text-xl font-extrabold text-ink">{t("review.saveFailed")}</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
