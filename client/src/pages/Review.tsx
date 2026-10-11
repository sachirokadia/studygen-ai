import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Flashcard } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageBg, PageHeader, Pill } from "../components/ui";
import Creature, { type CreatureKind } from "../components/creatures";
import { ClozeText, hasCloze, stripCloze } from "../lib/cloze";

// Two simple choices. NEED PRACTICE = grade 2, GOT IT! = grade 4.
export default function Review() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [lastGotIt, setLastGotIt] = useState<boolean | null>(null);
  const [gradeError, setGradeError] = useState(false);

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
        <Card className="washi relative text-center">
          <Creature kind="dog" size={104} className="mx-auto animate-bob" />
          <h2 className="mt-3 font-display text-4xl font-extrabold uppercase">{t("review.allDone")}</h2>
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
              setLastGotIt(null);
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
                {!flipped ? (
                  <>
                    <p className="font-display text-3xl font-extrabold leading-snug">
                      {hasCloze(card.front) ? (
                        <ClozeText text={card.front} revealed={false} />
                      ) : (
                        card.front
                      )}
                    </p>
                    <p className="mt-6 font-body text-sm font-bold text-ink/50">{t("review.tapToFlip")}</p>
                  </>
                ) : (
                  <>
                    {hasCloze(card.front) && (
                      <p className="font-display text-3xl font-extrabold leading-snug">
                        <ClozeText text={card.front} revealed={true} />
                      </p>
                    )}
                    <p className="mt-4 font-body text-xl font-bold text-ink/80">
                      {stripCloze(card.back)}
                    </p>
                  </>
                )}
              </div>
            </div>
            {flipped && (
              <div className="mt-5 grid grid-cols-2 gap-4">
                <Button
                  variant="pink"
                  onClick={() => handleGrade(false)}
                  disabled={gradeMut.isPending}
                  className="!py-5 !text-2xl"
                >
                  {t("review.needPractice")}
                </Button>
                <Button
                  variant="green"
                  onClick={() => handleGrade(true)}
                  disabled={gradeMut.isPending}
                  className="!py-5 !text-2xl"
                >
                  {t("review.gotIt")}
                </Button>
              </div>
            )}
            {gradeError && (
              <div className="paper-card mt-4 border-btnpink p-4 text-center">
                <p className="font-display text-xl font-extrabold uppercase">{t("review.saveFailed")}</p>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
