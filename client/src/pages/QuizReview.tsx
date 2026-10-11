import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";
import { api, type Quiz, type QuizAttempt } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg, PageHeader, Sticker } from "../components/ui";
import Creature from "../components/creatures";

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
  const attempt = attemptsQ.data?.[0];
  if (!quiz || !attempt) return <EmptyState title={t("common.empty")} />;

  const answerByQ = new Map(attempt.answers.map((a) => [a.questionId, a.selected]));
  const pct = attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageBg variant="night" />
      <Link to={`/decks/${quiz.deckId}`} className="mb-4 inline-flex items-center gap-1 font-display text-xl font-extrabold text-paper/70 hover:text-paper">
        <ArrowLeft className="h-4 w-4" strokeWidth={2.75} />
        {t("btn.back")}
      </Link>
      <PageHeader title={quiz.title} light />

      <div className="paper-card washi relative mb-6 p-6 text-center">
        <Creature kind={pct >= 70 ? "dog" : "grey"} size={104} className="mx-auto animate-bob" />
        <p className="mt-2 font-display text-2xl font-extrabold text-ink/60">{t("quiz.score")}</p>
        <p className="mt-1 font-display text-6xl font-extrabold">
          {attempt.score}
          <span className="text-3xl text-ink/40">/{attempt.total}</span>
        </p>
        <p className={clsx("mt-1 font-display text-3xl font-extrabold", pct >= 70 ? "text-grassdark" : pct >= 40 ? "text-ink/60" : "text-red-600")}>
          {pct}%
        </p>
      </div>

      <h2 className="mb-3 font-display text-2xl font-extrabold uppercase text-paper">{t("quiz.reviewAnswers")}</h2>
      <div className="space-y-4">
        {(quiz.questions ?? []).map((q, qi) => {
          const selected = answerByQ.get(q.id) ?? -1;
          const correct = selected === q.correctIndex;
          return (
            <div key={q.id} className="paper-card !p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-display text-2xl font-extrabold leading-snug">
                  {qi + 1}. {q.question}
                </p>
                {correct ? (
                  <Sticker color="bg-grass" className="shrink-0">✓ {t("quiz.correct")}</Sticker>
                ) : (
                  <Sticker color="bg-btnpink" className="shrink-0">✗ {t("quiz.wrong")}</Sticker>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={clsx(
                      "rounded-xl border-[3px] px-4 py-2.5 font-body text-sm font-semibold",
                      oi === q.correctIndex && "border-grassdark bg-grass/25 font-bold text-ink",
                      oi === selected && oi !== q.correctIndex && "border-btnpink bg-btnpink/30 font-bold text-ink",
                      oi !== selected && oi !== q.correctIndex && "border-ink/20 text-ink/50",
                    )}
                  >
                    {opt}
                    {oi === q.correctIndex && <span className="ml-2 text-xs">✓ {t("quiz.correct")}</span>}
                    {oi === selected && oi !== q.correctIndex && <span className="ml-2 text-xs">✗ {t("quiz.wrong")}</span>}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="mt-3 rounded-xl border-[3px] border-ink/20 bg-paperdark p-3 font-body text-sm font-semibold text-ink/70">
                  <span className="font-bold text-ink">{t("quiz.explanation")}: </span>
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <Link to={`/quiz/${id}`}>
        <Button variant="secondary" className="mt-6 w-full">
          {t("btn.retry")}
        </Button>
      </Link>
    </div>
  );
}
