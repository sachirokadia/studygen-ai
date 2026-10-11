import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, Play, Plus, Printer, Trash2 } from "lucide-react";
import { api, type Deck, type Flashcard, type Quiz } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, PageBg, PageHeader, Pill, TextInput, Field } from "../components/ui";
import BookmarkToggle from "../components/BookmarkToggle";
import { ClozeText, hasCloze, stripCloze } from "../lib/cloze";

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

  const [showAddCard, setShowAddCard] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [cardError, setCardError] = useState(false);
  const [ankiBusy, setAnkiBusy] = useState(false);
  const [ankiMsg, setAnkiMsg] = useState<"done" | "error" | null>(null);

  const cardMut = useMutation({
    mutationFn: () => api.post<Flashcard>(`/flashcards`, { deckId: id, front: front.trim(), back: back.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deck", id] });
      setFront("");
      setBack("");
      setShowAddCard(false);
      setCardError(false);
    },
    onError: () => setCardError(true),
  });

  if (detailQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (detailQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => detailQ.refetch()} retryLabel={t("common.retry")} />;
  if (!detailQ.data) return <EmptyState title={t("common.empty")} />;

  const { deck, flashcards, quizzes } = detailQ.data;

  const handleAnki = async () => {
    if (flashcards.length === 0 || ankiBusy) return;
    setAnkiBusy(true);
    setAnkiMsg(null);
    try {
      const { exportApkg } = await import("../lib/anki");
      await exportApkg(deck.title, flashcards.map((c) => ({ front: c.front, back: c.back })));
      setAnkiMsg("done");
    } catch {
      setAnkiMsg("error");
    } finally {
      setAnkiBusy(false);
    }
  };

  return (
    <div>
      <PageBg variant="sky" />
      <div className="paper-card washi relative mx-auto max-w-3xl p-6">
        <PageHeader
          title={deck.title}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <BookmarkToggle kind="deck" refId={deck.id} label={deck.title} />
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

        <div className="mb-5">
          <Pill>
            {flashcards.length} {t("decks.cards")}
          </Pill>
        </div>

        <Link to={`/review?deckId=${deck.id}`} className="btn-blue mb-8 inline-flex w-full !py-4 !text-2xl">
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
          <Button variant="yellow" onClick={() => setShowAddCard((s) => !s)} className="btn-sm">
            <Plus className="h-4 w-4" strokeWidth={2.75} />
            {t("deck.addCard")}
          </Button>
          <Button
            variant="cream"
            onClick={handleAnki}
            disabled={ankiBusy || flashcards.length === 0}
            className="btn-sm"
          >
            <Download className="h-4 w-4" strokeWidth={2.75} />
            {ankiBusy ? t("common.loading") : t("deck.sendToAnki")}
          </Button>
          <Link to={`/decks/${deck.id}/print`} className="btn-cream btn-sm inline-flex items-center gap-1">
            <Printer className="h-4 w-4" strokeWidth={2.75} />
            {t("deck.print")}
          </Link>
        </div>

        {ankiMsg && (
          <p className={`mb-4 text-center font-body text-sm font-bold ${ankiMsg === "done" ? "text-green-700" : "text-red-600"}`}>
            {ankiMsg === "done" ? t("deck.ankiDone") : t("deck.ankiError")}
          </p>
        )}

        {showAddCard && (
          <div className="paper-card mb-8 !p-4">
            <div className="space-y-3">
              <Field label={t("deck.cardFront")}>
                <TextInput
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  placeholder={t("deck.cardFrontPh")}
                  className="!py-3 !text-lg"
                />
              </Field>
              <Field label={t("deck.cardBack")}>
                <TextInput
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  placeholder={t("deck.cardBackPh")}
                  className="!py-3 !text-lg"
                />
              </Field>
              {cardError && (
                <p className="font-body text-sm font-bold text-red-600">{t("common.error")}</p>
              )}
              <Button
                onClick={() => cardMut.mutate()}
                disabled={cardMut.isPending || !front.trim() || !back.trim()}
                className="w-full !py-3 !text-xl"
              >
                {cardMut.isPending ? t("common.loading") : t("btn.save")}
              </Button>
            </div>
          </div>
        )}

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
                  <p className="font-display text-xl font-extrabold leading-snug">
                    {hasCloze(c.front) ? <ClozeText text={c.front} revealed={false} /> : c.front}
                  </p>
                  <p className="mt-1 font-body text-sm font-semibold text-ink/70">
                    {hasCloze(c.back) ? <ClozeText text={c.back} revealed={true} /> : stripCloze(c.back)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
