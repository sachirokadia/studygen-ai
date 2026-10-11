import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookmarkPlus, Play, Plus, Trash2 } from "lucide-react";
import { api, type Deck, type Flashcard, type Quiz } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, Field, HangTag, LoadingState, Modal, PageBg, PageHeader, Pill, TextInput } from "../components/ui";

interface DeckDetailData {
  deck: Deck;
  flashcards: Flashcard[];
  quizzes: Quiz[];
}

export default function DeckDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quizModal, setQuizModal] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");

  const detailQ = useQuery({
    queryKey: ["deck", id],
    queryFn: () => api.get<DeckDetailData>(`/decks/${id}`),
    enabled: !!id,
  });

  const deleteMut = useMutation({
    mutationFn: () => api.del(`/decks/${id}`),
    onSuccess: () => navigate("/decks"),
  });

  const quizMut = useMutation({
    mutationFn: () => api.post<Quiz>(`/quizzes`, { deckId: id, title: quizTitle.trim() || undefined }),
    onSuccess: (quiz) => {
      setQuizModal(false);
      setQuizTitle("");
      queryClient.invalidateQueries({ queryKey: ["deck", id] });
      navigate(`/quiz/${quiz.id}`);
    },
  });

  const bookmarkMut = useMutation({
    mutationFn: () =>
      api.post("/bookmarks", { kind: "deck", refId: id, label: detailQ.data?.deck.title ?? "Deck" }),
  });

  if (detailQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (detailQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => detailQ.refetch()} retryLabel={t("common.retry")} />;
  if (!detailQ.data) return <EmptyState title={t("common.empty")} />;

  const { deck, flashcards, quizzes } = detailQ.data;

  return (
    <div>
      <PageBg variant="sky" />
      <div className="paper-card washi relative mx-auto max-w-3xl p-6">
        <PageHeader
          title={deck.title}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => bookmarkMut.mutate()} disabled={bookmarkMut.isPending}>
                <BookmarkPlus className="h-4 w-4" strokeWidth={2.75} />
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate();
                }}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.75} />
                {t("btn.delete")}
              </Button>
            </div>
          }
        />

        {deck.summary && (
          <div className="mb-5">
            <h2 className="mb-2 font-display text-2xl font-extrabold uppercase">{t("decks.summary")}</h2>
            <p className="whitespace-pre-wrap font-body text-sm font-semibold text-ink/70">{deck.summary}</p>
          </div>
        )}

        <div className="mb-5 flex flex-wrap gap-2">
          <Pill>
            {deck.cardCount} {t("decks.cards")}
          </Pill>
          <Pill color="bg-btnblue">
            {deck.quizCount} {t("decks.quizzes")}
          </Pill>
          <Pill color="bg-btnpink">
            {flashcards.length} {t("decks.flashcards")}
          </Pill>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <Link to="/review" className="btn-blue">
            <Play className="h-4 w-4" strokeWidth={2.75} />
            {t("dash.startReview")}
          </Link>
          <button onClick={() => navigate("/decks")} className="btn-yellow btn-sm">
            <ArrowLeft className="h-4 w-4" strokeWidth={2.75} />
            {t("btn.back")}
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <h2 className="mb-3 font-display text-2xl font-extrabold uppercase">
              {t("decks.flashcards")} ({flashcards.length})
            </h2>
            {flashcards.length === 0 ? (
              <EmptyState title={t("common.empty")} />
            ) : (
              <div className="space-y-3">
                {flashcards.map((c, i) => (
                  <div
                    key={c.id}
                    className={`paper-card !p-4 ${i % 2 === 0 ? "-rotate-1" : "rotate-1"}`}
                  >
                    <p className="font-display text-xl font-extrabold leading-snug">{c.front}</p>
                    <p className="mt-1 font-body text-sm font-semibold text-ink/70">{c.back}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-2xl font-extrabold uppercase">
                {t("decks.quizzesList")} ({quizzes.length})
              </h2>
              <Button variant="secondary" onClick={() => setQuizModal(true)} className="btn-sm">
                <Plus className="h-4 w-4" strokeWidth={2.75} />
                {t("decks.newQuiz")}
              </Button>
            </div>
            {quizzes.length === 0 ? (
              <EmptyState title={t("common.empty")} />
            ) : (
              <div className="space-y-3">
                {quizzes.map((q) => (
                  <div key={q.id} className="paper-card !p-4">
                    <div className="flex items-center justify-between gap-2">
                      <HangTag color="bg-machinepurple" className="!text-base">
                        {q.title}
                      </HangTag>
                      <Link to={`/quiz/${q.id}`} className="btn-blue btn-sm">
                        <Play className="h-3.5 w-3.5" strokeWidth={2.75} />
                        {t("decks.takeQuiz")}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {quizModal && (
        <Modal title={t("decks.newQuiz")} onClose={() => setQuizModal(false)}>
          <Field label={t("decks.deckTitle")}>
            <TextInput value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} placeholder="Quiz 1" />
          </Field>
          <Button onClick={() => quizMut.mutate()} disabled={quizMut.isPending} className="mt-4 w-full">
            {quizMut.isPending ? t("common.loading") : t("btn.create")}
          </Button>
          {quizMut.isError && <p className="mt-2 font-body text-sm font-bold text-red-600">{t("common.error")}</p>}
        </Modal>
      )}
    </div>
  );
}
