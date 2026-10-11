import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { api, type Quiz } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageBg, Pill } from "../components/ui";

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
      <h1 className="title-chunky-light text-center">{quiz.title}</h1>

      <div className="mb-6 mt-4 flex justify-center">
        <Pill color="bg-machinepurple" className="!text-xl">
          {qi + 1} {t("review.of")} {questions.length}
        </Pill>
      </div>

      <Card>
        <div id="quiz-card">
        <p className="font-display text-3xl font-extrabold leading-snug">{q.question}</p>
        <div className="mt-6 space-y-3">
          {q.options.map((opt, oi) => (
            <button
              key={oi}
              onClick={() => {
                setAnswers((a) => ({ ...a, [q.id]: oi }));
                setMissedMsg(false);
              }}
              className={clsx(
                "btn-cream w-full !py-4 text-left !text-lg",
                answers[q.id] === oi && "!bg-btnyellow",
              )}
            >
              <span className="font-body text-base font-bold">{opt}</span>
            </button>
          ))}
        </div>
        </div>
      </Card>

      {missedMsg && (
        <div className="paper-card mt-4 border-btnyellow p-4 text-center">
          <p className="font-display text-xl font-extrabold uppercase">{t("quiz.missedOne")}</p>
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
          <Button variant="blue" onClick={() => setQi((i) => i + 1)} className="w-full !py-4 !text-2xl">
            {t("btn.next")}
          </Button>
        ) : (
          <Button
            variant="green"
            onClick={handleDone}
            disabled={submitMut.isPending}
            className="w-full !py-4 !text-2xl"
          >
            {submitMut.isPending ? t("common.loading") : t("quiz.submit")}
          </Button>
        )}
        <Link to={`/decks/${quiz.deckId}`} className="btn-pink btn-sm text-center">
          {t("btn.cancel")}
        </Link>
      </div>
    </div>
  );
}
