import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Plus, Trash2 } from "lucide-react";
import { api, type Deck, type Flashcard, type Quiz } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg, PageHeader, Pill } from "../components/ui";

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
    mutationFn: () => api.post<Quiz>(`/quizzes`, { deckId: id }),
    onSuccess: (quiz) => {
      queryClient.invalidateQueries({ queryKey: ["deck", id] });
      navigate(`/quiz/${quiz.id}`);
    },
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
          }
        />

        {deck.summary && (
          <div className="mb-5">
            <h2 className="mb-2 font-display text-2xl font-extrabold uppercase">{t("decks.summary")}</h2>
            <p className="whitespace-pre-wrap font-body text-sm font-semibold text-ink/70">{deck.summary}</p>
          </div>
        )}

        <div className="mb-5">
          <Pill>
            {flashcards.length} {t("decks.cards")}
          </Pill>
        </div>

        <Link to="/review" className="btn-blue mb-8 inline-flex w-full !py-4 !text-2xl">
          <Play className="h-5 w-5" strokeWidth={2.75} />
          {t("deck.studyPack")}
        </Link>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <button onClick={() => navigate("/decks")} className="btn-yellow btn-sm">
            <ArrowLeft className="h-4 w-4" strokeWidth={2.75} />
            {t("btn.back")}
          </button>
          <Button variant="cream" onClick={() => quizMut.mutate()} disabled={quizMut.isPending} className="btn-sm">
            <Plus className="h-4 w-4" strokeWidth={2.75} />
            {quizMut.isPending ? t("common.loading") : t("deck.makeQuiz")}
          </Button>
        </div>

        {quizzes.length > 0 && (
          <div className="mb-8">
            <div className="space-y-3">
              {quizzes.map((q) => (
                <Link key={q.id} to={`/quiz/${q.id}`} className="btn-pink w-full !py-3 !text-xl">
                  <Play className="h-5 w-5" strokeWidth={2.75} />
                  {t("deck.playQuiz")}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div>
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
      </div>
    </div>
  );
}
