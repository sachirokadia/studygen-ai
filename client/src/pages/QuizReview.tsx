import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, type Quiz, type QuizAttempt } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg } from "../components/ui";
import Creature from "../components/creatures";

function Stars({ pct }: { pct: number }) {
  const n = pct >= 80 ? 3 : pct >= 50 ? 2 : 1;
  return (
    <div className="mt-2 flex justify-center gap-2" aria-label={`${n} stars`}>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className="font-display text-5xl"
          style={{ color: i <= n ? "#FFD54F" : "#2B2B2B33", textShadow: "2px 2px 0 #2B2B2B" }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

export default function QuizReview() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();

  const quizQ = useQuery({ queryKey: ["quiz", id], queryFn: () => api.get<Quiz>(`/quizzes/${id}`), enabled: !!id });
  const attemptsQ = useQuery({
    queryKey: ["attempts", id],
    queryFn: () => api.get<QuizAttempt[]>(`/quizzes/${id}/attempts`),
    enabled: !!id,
  });

  if (quizQ.isLoading || attemptsQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (quizQ.isError || attemptsQ.isError)
    return (
      <ErrorState
        message={t("common.error")}
        onRetry={() => {
          quizQ.refetch();
          attemptsQ.refetch();
        }}
        retryLabel={t("common.retry")}
      />
    );

  const quiz = quizQ.data;
  const attempts = attemptsQ.data ?? [];
  const attempt = attempts[attempts.length - 1];
  if (!quiz || !attempt) return <EmptyState title={t("common.empty")} />;

  const pct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-xl">
      <PageBg variant="night" />
      <div className="paper-card washi relative mt-8 p-8 text-center">
        <Creature kind={pct >= 50 ? "dog" : "grey"} size={120} className="mx-auto animate-bob" />
        <Stars pct={pct} />
        <p className="mt-4 font-display text-2xl font-extrabold uppercase text-ink/60">{t("quiz.score")}</p>
        <p className="mt-1 font-display text-6xl font-extrabold">
          {attempt.score} {t("quiz.outOf")} {attempt.total}!
        </p>
        <Link to={`/quiz/${id}`} className="mt-6 block">
          <Button variant="green" className="w-full !py-4 !text-2xl">
            {t("quiz.practiceAgain")}
          </Button>
        </Link>
        <Link to={`/decks/${quiz.deckId}`} className="btn-cream btn-sm mt-3 inline-block">
          {t("btn.back")}
        </Link>
      </div>
    </div>
  );
}
