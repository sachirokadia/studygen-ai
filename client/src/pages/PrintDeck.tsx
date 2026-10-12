import { useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { api, type Deck, type Flashcard } from "../lib/api";
import { useLang } from "../lib/i18n";
import { EmptyState, ErrorState, LoadingState } from "../components/ui";
import { stripCloze } from "../lib/cloze";

interface DeckDetailData {
  deck: Deck;
  flashcards: Flashcard[];
}

/** Clean printable Q/A list. No nav, no buttons on paper. */
export default function PrintDeck() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLang();
  const printRef = useRef<HTMLDivElement>(null);

  const detailQ = useQuery({
    queryKey: ["deck", id],
    queryFn: () => api.get<DeckDetailData>(`/decks/${id}`),
    enabled: !!id,
  });

  if (detailQ.isLoading) return <LoadingState label={t("common.loading")} />;
  if (detailQ.isError)
    return <ErrorState message={t("common.error")} onRetry={() => detailQ.refetch()} retryLabel={t("common.retry")} />;
  if (!detailQ.data) return <EmptyState title={t("common.empty")} />;

  const { deck, flashcards } = detailQ.data;

  return (
    <div className="min-h-screen bg-cream p-6">
      <div className="no-print mx-auto mb-6 flex max-w-3xl flex-wrap items-center gap-3">
        <Link to={`/decks/${id}`} className="btn-yellow btn-sm">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.75} />
          {t("btn.back")}
        </Link>
        <button onClick={() => window.print()} className="btn-blue btn-sm">
          <Printer className="h-4 w-4" strokeWidth={2.75} />
          {t("deck.print")}
        </button>
      </div>

      <div ref={printRef} className="print-sheet mx-auto max-w-3xl">
        <h1 className="font-display text-4xl font-extrabold">{deck.title}</h1>
        <p className="mt-1 font-body text-sm font-bold text-ink/60">
          {flashcards.length} {t("decks.cards")}
        </p>
        <div className="mt-6 space-y-5">
          {flashcards.map((c, i) => (
            <div key={c.id} className="print-card">
              <p className="font-display text-lg font-extrabold">
                {i + 1}. {stripCloze(c.front)}
              </p>
              <p className="mt-1 font-body text-base text-ink/80">{stripCloze(c.back)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
