import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api, type Quiz, type QuizAttempt } from "../lib/api";
import { useLang } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState, PageBg } from "../components/ui";
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
  const [showAnswers, setShowAnswers] = useState(false);

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

  const questions = quiz.questions ?? [];
  const answerByQid = new Map(attempt.answers.map((a) => [a.questionId, a.selected]));

  return (
    <div className="mx-auto max-w-xl">
      <PageBg variant="night" />
      <div className="paper-card washi animate-pop-in relative mt-8 !rounded-[28px] p-8 text-center">
        <Creature kind={pct >= 50 ? "dog" : "grey"} size={120} className="mx-auto animate-bob" />
        <h2 className="mt-3 font-display text-4xl font-extrabold">{t("review.allDone")}</h2>
        <Stars pct={pct} />
        <p className="mt-4 font-display text-xl font-extrabold text-ink/60">{t("quiz.score")}</p>
        <p className="mt-1 font-display text-6xl font-extrabold">
          {attempt.score} {t("quiz.outOf")} {attempt.total}!
        </p>

        {questions.length > 0 && (
          <button
            onClick={() => setShowAnswers((s) => !s)}
            className="mt-4 font-display text-lg font-extrabold text-ink/60 underline decoration-btnyellow decoration-[3px] underline-offset-4"
          >
            {showAnswers ? t("quiz.hideAnswers") : t("quiz.seeAnswers")} {showAnswers ? "▲" : "▼"}
          </button>
        )}

        <Link to={`/quiz/${id}`} className="mt-6 block">
          <button className="btn-gradient w-full !py-4 !text-2xl">
            {t("quiz.practiceAgain")}
          </button>
        </Link>
        <Link to={`/decks/${quiz.deckId}`} className="btn-cream btn-sm mt-3 inline-block">
          {t("btn.back")}
        </Link>
      </div>

      {showAnswers && (
        <div className="mt-6 space-y-4 pb-10">
          {questions.map((q, i) => {
            const picked = answerByQid.get(q.id);
            const correct = picked === q.correctIndex;
            return (
              <div key={q.id} className="paper-card !p-5">
                <p className="font-display text-xl font-extrabold leading-snug">
                  {i + 1}. {q.question}
                </p>
                <div className="mt-3 space-y-2">
                  {q.options.map((opt, oi) => {
                    const isPicked = picked === oi;
                    const isRight = oi === q.correctIndex;
                    return (
                      <div
                        key={oi}
                        className={clsx(
                          "rounded-xl border-[3px] px-3 py-2 font-body text-sm font-bold",
                          isRight
                            ? "border-ink bg-grass/40"
                            : isPicked
                              ? "border-ink bg-btnpink/40"
                              : "border-ink/20 bg-paper",
                        )}
                      >
                        {opt}
                        {isRight && <span className="ml-2">✓ {t("quiz.rightAnswer")}</span>}
                        {isPicked && !isRight && (
                          <span className="ml-2">← {t("quiz.youPicked")}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!correct && picked !== undefined && (
                  <p className="mt-2 font-body text-sm font-bold text-ink/60">
                    {t("quiz.youPicked")}: {q.options[picked] ?? "—"}
                  </p>
                )}
                {q.explanation && (
                  <p className="mt-3 border-t-[3px] border-dashed border-ink/20 pt-2 font-body text-sm font-semibold text-ink/70">
                    <span className="font-extrabold">{t("quiz.explanation")}: </span>
                    {q.explanation}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
