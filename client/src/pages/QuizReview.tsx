import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
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
          className="text-5xl font-extrabold"
          style={{ color: i <= n ? "#FFA31A" : "#1111111A", textShadow: "0 3px 10px rgba(255,163,26,0.35)" }}
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
      <div className="card animate-fade-up relative mt-8 !rounded-[28px] p-8 text-center">
        <div className="absolute inset-x-8 top-4 flex justify-between" aria-hidden="true">
          <Creature kind="chick" size={44} className="animate-float" />
          <Creature kind="orange" size={52} className="animate-float" />
        </div>
        <Creature kind={pct >= 50 ? "dog" : "grey"} size={120} className="mx-auto animate-float" />
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-ink">{t("review.allDone")}</h2>
        <Stars pct={pct} />
        <p className="mt-4 text-xl font-extrabold text-ink/60">{t("quiz.score")}</p>
        <p
          className="mt-1 bg-clip-text text-6xl font-extrabold text-transparent"
          style={{ backgroundImage: "linear-gradient(135deg, #FFA94D 0%, #FF5FA2 100%)" }}
        >
          {attempt.score} {t("quiz.outOf")} {attempt.total}!
        </p>

        {questions.length > 0 && (
          <button
            onClick={() => setShowAnswers((s) => !s)}
            className="mt-4 text-lg font-extrabold text-ink/60 underline decoration-tangerine decoration-[3px] underline-offset-4"
          >
            {showAnswers ? t("quiz.hideAnswers") : t("quiz.seeAnswers")} {showAnswers ? "▲" : "▼"}
          </button>
        )}

        <Link to={`/quiz/${id}`} className="mt-6 block">
          <Button variant="accent" className="w-full !py-4 !text-2xl">
            {t("quiz.practiceAgain")}
          </Button>
        </Link>
        <Link to={`/decks/${quiz.deckId}`} className="mt-3 block">
          <Button variant="soft" className="btn-sm w-full !text-lg">
            {t("btn.back")}
          </Button>
        </Link>
      </div>

      {showAnswers && (
        <div className="mt-6 space-y-4 pb-10">
          {questions.map((q, i) => {
            const picked = answerByQid.get(q.id);
            const correct = picked === q.correctIndex;
            return (
              <div key={q.id} className="card !p-5">
                <p className="text-xl font-extrabold leading-snug tracking-tight text-ink">
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
                          "rounded-xl border-2 px-3 py-2 text-sm font-bold text-ink",
                          isRight
                            ? "border-mint bg-mint/50"
                            : isPicked
                              ? "border-berry/40 bg-berry/10"
                              : "border-[#ECECF1] bg-paper",
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
                  <p className="mt-2 text-sm font-bold text-ink/60">
                    {t("quiz.youPicked")}: {q.options[picked] ?? "—"}
                  </p>
                )}
                {q.explanation && (
                  <p className="mt-3 border-t-2 border-dashed border-[#ECECF1] pt-2 text-sm font-semibold text-ink/70">
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
