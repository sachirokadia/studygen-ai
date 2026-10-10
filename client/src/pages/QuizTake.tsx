import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Timer } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type Quiz } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../components/ui";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function QuizTake() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const quizQ = useQuery({ queryKey: ["quiz", id], queryFn: () => api.get<Quiz>(`/quizzes/${id}`), enabled: !!id });

  const questions = useMemo(() => {
    const qs = quizQ.data?.questions ?? [];
    return shuffle(qs);
  }, [quizQ.data]);

  useEffect(() => {
    const limit = quizQ.data?.timeLimitS;
    if (limit && limit > 0) setSecondsLeft(limit);
  }, [quizQ.data]);

  const submitMut = useMutation({
    mutationFn: () =>
      api.post<{ score: number; total: number; attemptId: string }>(`/quizzes/${id}/attempt`, {
        answers: questions.map((q) => ({ questionId: q.id, selected: answers[q.id] ?? -1 })),
      }),
    onSuccess: () => navigate(`/quiz/${id}/review`),
    onError: (err) => {
      if (err instanceof ApiError) alert(err.message);
    },
  });

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 && !submitMut.isPending && !autoSubmitted) {
      setAutoSubmitted(true);
      submitMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (quizQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (quizQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => quizQ.refetch()} retryLabel={t("common.retry")} />;
  if (!quizQ.data || questions.length === 0) return <EmptyState title={t("common.empty")} />;

  const quiz = quizQ.data;
  const urgent = secondsLeft !== null && secondsLeft < 60;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={quiz.title} />
      {secondsLeft !== null && (
        <div className={clsx("mb-4 flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold", urgent ? "bg-red-50 text-red-700" : "bg-indigo-50 text-indigo-700")}>
          <Timer className="h-4 w-4" />
          {t("quiz.timeLeft")}: {formatTime(secondsLeft)}
        </div>
      )}
      {autoSubmitted && <p className="mb-4 text-sm text-amber-600">{t("quiz.autoSubmitted")}</p>}

      <div className="space-y-4">
        {questions.map((q, qi) => (
          <Card key={q.id}>
            <p className="font-medium">
              {qi + 1}. {q.question}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                  className={clsx(
                    "w-full rounded-xl border px-4 py-2.5 text-left text-sm transition",
                    answers[q.id] === oi
                      ? "border-indigo-500 bg-indigo-50 font-medium text-indigo-800"
                      : "border-slate-200 hover:bg-slate-50",
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Button onClick={() => submitMut.mutate()} disabled={submitMut.isPending} className="mt-6 w-full">
        {submitMut.isPending ? t("common.loading") : t("quiz.submit")}
      </Button>
    </div>
  );
}
