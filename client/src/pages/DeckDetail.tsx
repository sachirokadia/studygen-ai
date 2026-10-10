import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BookmarkPlus, Play, Plus, Trash2 } from "lucide-react";
import { api, type Deck, type Flashcard, type Quiz } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, Modal, PageHeader, TextInput } from "../components/ui";

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
      <button onClick={() => navigate("/decks")} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" />
        {t("btn.back")}
      </button>
      <PageHeader
        title={deck.title}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => bookmarkMut.mutate()} disabled={bookmarkMut.isPending}>
              <BookmarkPlus className="h-4 w-4" />
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
            >
              <Trash2 className="h-4 w-4" />
              {t("btn.delete")}
            </Button>
          </div>
        }
      />

      {deck.summary && (
        <Card className="mb-6">
          <h2 className="mb-2 font-semibold">{t("decks.summary")}</h2>
          <p className="whitespace-pre-wrap text-sm text-slate-600">{deck.summary}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-semibold">
            {t("decks.flashcards")} ({flashcards.length})
          </h2>
          {flashcards.length === 0 ? (
            <EmptyState title={t("common.empty")} />
          ) : (
            <div className="space-y-2">
              {flashcards.map((c) => (
                <Card key={c.id} className="!p-4">
                  <p className="text-sm font-medium">{c.front}</p>
                  <p className="mt-1 text-sm text-slate-500">{c.back}</p>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">
              {t("decks.quizzesList")} ({quizzes.length})
            </h2>
            <Button variant="secondary" onClick={() => setQuizModal(true)}>
              <Plus className="h-4 w-4" />
              {t("decks.newQuiz")}
            </Button>
          </div>
          {quizzes.length === 0 ? (
            <EmptyState title={t("common.empty")} />
          ) : (
            <div className="space-y-2">
              {quizzes.map((q) => (
                <Card key={q.id} className="!p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{q.title}</p>
                    <Link to={`/quiz/${q.id}`} className="btn-primary !px-3 !py-1.5 text-xs">
                      <Play className="h-3.5 w-3.5" />
                      {t("decks.takeQuiz")}
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
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
          {quizMut.isError && <p className="mt-2 text-sm text-red-600">{t("common.error")}</p>}
        </Modal>
      )}
    </div>
  );
}
