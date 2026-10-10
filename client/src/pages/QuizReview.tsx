import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import clsx from "clsx";
import { api, type Quiz, type QuizAttempt } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../components/ui";

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
      <Link to={`/decks/${quiz.deckId}`} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" />
        {t("btn.back")}
      </Link>
      <PageHeader title={quiz.title} />

      <Card className="mb-6 text-center">
        <p className="text-sm text-slate-500">{t("quiz.score")}</p>
        <p className="mt-1 text-4xl font-bold">
          {attempt.score}
          <span className="text-xl text-slate-400">/{attempt.total}</span>
        </p>
        <p className={clsx("mt-1 text-sm font-semibold", pct >= 70 ? "text-green-600" : pct >= 40 ? "text-amber-600" : "text-red-600")}>
          {pct}%
        </p>
      </Card>

      <h2 className="mb-3 font-semibold">{t("quiz.reviewAnswers")}</h2>
      <div className="space-y-4">
        {(quiz.questions ?? []).map((q, qi) => {
          const selected = answerByQ.get(q.id) ?? -1;
          const correct = selected === q.correctIndex;
          return (
            <Card key={q.id}>
              <div className="flex items-start gap-2">
                {correct ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                )}
                <p className="font-medium">
                  {qi + 1}. {q.question}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className={clsx(
                      "rounded-xl border px-4 py-2.5 text-sm",
                      oi === q.correctIndex && "border-green-300 bg-green-50 font-medium text-green-800",
                      oi === selected && oi !== q.correctIndex && "border-red-300 bg-red-50 text-red-700",
                      oi !== selected && oi !== q.correctIndex && "border-slate-200 text-slate-500",
                    )}
                  >
                    {opt}
                    {oi === q.correctIndex && <span className="ml-2 text-xs">✓ {t("quiz.correct")}</span>}
                    {oi === selected && oi !== q.correctIndex && <span className="ml-2 text-xs">✗ {t("quiz.wrong")}</span>}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="font-medium">{t("quiz.explanation")}: </span>
                  {q.explanation}
                </p>
              )}
            </Card>
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
