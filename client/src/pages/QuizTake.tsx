import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { api, type Quiz } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg } from "../components/ui";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// One question at a time, big buttons. Timer runs silently in the background.
export default function QuizTake() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const navigate = useNavigate();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [qi, setQi] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [missedMsg, setMissedMsg] = useState(false);
  const [submitError, setSubmitError] = useState(false);

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
    mutationFn: (opts?: { auto?: boolean }) => {
      const list = questions.map((q) => ({ questionId: q.id, selected: answers[q.id] ?? -1 }));
      // On auto-submit (time's up), only send answered questions — never -1.
      const payload = opts?.auto ? list.filter((a) => a.selected >= 0) : list;
      return api.post<{ score: number; total: number; attemptId: string }>(`/quizzes/${id}/attempt`, {
        answers: payload,
      });
    },
    onSuccess: () => navigate(`/quiz/${id}/review`),
    onError: () => setSubmitError(true),
  });

  const jumpToFirstMissed = () => {
    const firstMissed = questions.findIndex((q) => answers[q.id] === undefined);
    if (firstMissed >= 0) {
      setMissedMsg(true);
      setSubmitError(false);
      setQi(firstMissed);
      requestAnimationFrame(() => {
        document.getElementById("quiz-card")?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    }
  };

  const handleDone = () => {
    if (questions.some((q) => answers[q.id] === undefined)) {
      jumpToFirstMissed();
      return;
    }
    setMissedMsg(false);
    setSubmitError(false);
    submitMut.mutate();
  };

  // Silent countdown — no timer shown, just auto-sends when time runs out.
  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  useEffect(() => {
    if (secondsLeft === 0 && !submitMut.isPending && !autoSubmitted) {
      setAutoSubmitted(true);
      // Time's up: send what they answered. If nothing answered, guide them instead.
      if (questions.some((q) => answers[q.id] !== undefined)) {
        submitMut.mutate({ auto: true });
      } else {
        jumpToFirstMissed();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  if (quizQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (quizQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => quizQ.refetch()} retryLabel={t("common.retry")} />;
  if (!quizQ.data || questions.length === 0) return <EmptyState title={t("common.empty")} />;

  const quiz = quizQ.data;
  const q = questions[qi]!;
  const isLast = qi === questions.length - 1;

  return (
    <div className="mx-auto max-w-2xl">
      <PageBg variant="night" />
      <h1 className="text-center text-[28px] font-extrabold leading-tight tracking-tight text-ink md:text-4xl">
        {quiz.title}
      </h1>

      <div className="mb-4 mt-3">
        <div className="mb-1.5 flex items-center justify-end text-sm font-extrabold">
          <span className="text-ink">
            {qi + 1} {t("review.of")} {questions.length}
          </span>
        </div>
        <div className="progress-track" role="progressbar" aria-valuenow={qi + 1} aria-valuemax={questions.length}>
          <div className="progress-fill" style={{ width: `${((qi + 1) / questions.length) * 100}%` }} />
        </div>
      </div>

      <div className="card !rounded-[28px] p-6 md:p-8">
        <div id="quiz-card">
        <p className="text-2xl font-extrabold leading-snug tracking-tight text-ink md:text-3xl">{q.question}</p>
        <div className="mt-6 space-y-3">
          {q.options.map((opt, oi) => {
            const selected = answers[q.id] === oi;
            const tints = ["bg-sky", "bg-lavender", "bg-peach", "bg-mint"];
            return (
              <button
                key={oi}
                onClick={() => {
                  setAnswers((a) => ({ ...a, [q.id]: oi }));
                  setMissedMsg(false);
                }}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-[20px] px-4 py-3.5 text-left transition active:scale-[0.98]",
                  selected
                    ? "bg-peach ring-[3px] ring-tangerine"
                    : tints[oi % tints.length],
                )}
                style={{ boxShadow: selected ? "0 10px 22px -10px rgba(255,169,77,0.6)" : "0 6px 14px -8px rgba(90,70,130,0.25)" }}
              >
                <span
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-base font-extrabold",
                    selected ? "bg-tangerine text-white" : "bg-white text-ink",
                  )}
                >
                  {String.fromCharCode(65 + oi)}
                </span>
                <span className="text-base font-bold text-ink">{opt}</span>
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {missedMsg && (
        <div className="card mt-4 border-2 border-amber/50 p-4 text-center">
          <p className="text-xl font-extrabold uppercase text-ink">{t("quiz.missedOne")}</p>
        </div>
      )}

      {submitError && (
        <div className="mt-4">
          <ErrorState
            message={t("common.error")}
            onRetry={() => {
              setSubmitError(false);
              handleDone();
            }}
            retryLabel={t("common.retry")}
          />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {!isLast ? (
          <Button variant="primary" onClick={() => setQi((i) => i + 1)} className="w-full !py-4 !text-2xl">
            {t("btn.next")}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleDone}
            disabled={submitMut.isPending}
            className="w-full !py-4 !text-2xl"
          >
            {submitMut.isPending ? t("common.loading") : t("quiz.submit")}
          </Button>
        )}
        <Link to={`/decks/${quiz.deckId}`} className="btn-soft btn-sm text-center">
          {t("btn.cancel")}
        </Link>
      </div>
    </div>
  );
}
