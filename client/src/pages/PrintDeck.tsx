import { useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { api, type Deck, type Flashcard } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, LoadingState, Pill } from "../components/ui";
import { stripCloze } from "../lib/cloze";

interface DeckDetailData {
  deck: Deck;
  flashcards: Flashcard[];
}

const NUM_BGS = ["bg-lavender", "bg-peach", "bg-mint", "bg-sky"];

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
    <div className="min-h-screen bg-paper p-6 font-sans">
      <div className="no-print mx-auto mb-6 flex max-w-3xl flex-wrap items-center gap-3">
        <Link to={`/decks/${id}`} className="btn-soft btn-sm">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.75} />
          {t("btn.back")}
        </Link>
        <Button variant="dark" onClick={() => window.print()} className="btn-sm">
          <Printer className="h-4 w-4" strokeWidth={2.75} />
          {t("deck.print")}
        </Button>
      </div>

      <div ref={printRef} className="print-sheet card mx-auto max-w-3xl p-8 print:shadow-none">
        <h1 className="text-4xl font-extrabold tracking-tight text-ink">{deck.title}</h1>
        <div className="mt-2">
          <Pill color="bg-peach">
            {flashcards.length} {t("decks.cards")}
          </Pill>
        </div>
        <div className="mt-6 space-y-5">
          {flashcards.map((c, i) => (
            <div key={c.id} className="print-card">
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-ink ${NUM_BGS[i % NUM_BGS.length]}`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-extrabold tracking-tight text-ink">{stripCloze(c.front)}</p>
                  <p className="mt-1 text-base font-medium text-ink/80">{stripCloze(c.back)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
