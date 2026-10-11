import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FileText, Link2, Plus, Type, Lightbulb, X } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type Deck, type StudyPackResult } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, Field, LoadingState, Modal, PageBg, Pill, Sticker, TextArea, TextInput } from "../components/ui";
import { AiNotice } from "../components/ui";
import Creature, { type CreatureKind } from "../components/creatures";

type SourceTab = "pdf" | "youtube" | "text" | "topic";

const DECK_CREATURES: CreatureKind[] = ["grey", "orange", "chick", "dog"];

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerModule = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const maxPages = Math.min(pdf.numPages, 40);
  let text = "";
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((item) => (typeof (item as { str?: string }).str === "string" ? (item as { str: string }).str : ""))
        .join(" ") + "\n";
  }
  return text.slice(0, 60_000);
}

function NewDeckModal({ onClose, onCreated }: { onClose: () => void; onCreated: (deckId?: string) => void }) {
  const { t } = useLang();
  const [tab, setTab] = useState<SourceTab>("pdf");
  const [title, setTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [aiMissing, setAiMissing] = useState(false);

  const tabs: { id: SourceTab; label: string; icon: typeof FileText }[] = [
    { id: "pdf", label: t("decks.tabPdf"), icon: FileText },
    { id: "youtube", label: t("decks.tabYoutube"), icon: Link2 },
    { id: "text", label: t("decks.tabText"), icon: Type },
    { id: "topic", label: t("decks.tabTopic"), icon: Lightbulb },
  ];

  const handlePdf = async (file: File) => {
    setPdfName(file.name);
    if (!title) setTitle(file.name.replace(/\.pdf$/i, ""));
    setBusy(true);
    setError("");
    try {
      const text = await extractPdfText(file);
      setTextContent(text);
    } catch {
      setError(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const handleFetchTranscript = async () => {
    if (!youtubeUrl.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.get<{ text: string }>(`/ai/youtube-transcript?url=${encodeURIComponent(youtubeUrl)}`);
      setTextContent(res.text);
      if (!title) setTitle("YouTube video");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    const content = tab === "pdf" || tab === "text" ? textContent : tab === "youtube" ? textContent : topic;
    const finalTitle = title.trim() || (tab === "topic" ? topic : tab === "youtube" ? "YouTube video" : pdfName || "Untitled");
    if (!content.trim() || !finalTitle) {
      setError(t("common.error"));
      return;
    }
    setBusy(true);
    setError("");
    setAiMissing(false);
    try {
      const res = await api.post<StudyPackResult>("/ai/study-pack", {
        title: finalTitle,
        sourceType: tab,
        sourceName: tab === "pdf" ? pdfName : tab === "youtube" ? youtubeUrl : undefined,
        content: content.slice(0, 60_000),
      });
      onCreated(res.deckId);
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) setAiMissing(true);
      else setError(err instanceof ApiError ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("decks.newFromSource")} onClose={onClose}>
      <div className="mb-4 grid grid-cols-4 gap-2">
        {tabs.map((tb) => (
          <button key={tb.id} onClick={() => setTab(tb.id)} className="flex justify-center">
            <Sticker
              color={tab === tb.id ? "bg-btnyellow" : "bg-paper"}
              className={clsx("flex-col !px-3 !py-2", tab !== tb.id && "opacity-60 hover:opacity-100")}
            >
              <tb.icon className="h-5 w-5" strokeWidth={2.75} />
              {tb.label}
            </Sticker>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <Field label={t("decks.deckTitle")}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cell Biology 101" />
        </Field>

        {tab === "pdf" && (
          <Field label={t("decks.tabPdf")}>
            <input
              type="file"
              accept="application/pdf"
              className="input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handlePdf(f);
              }}
            />
            {pdfName && <p className="mt-1 font-body text-xs font-bold text-ink/60">{pdfName} — {textContent.length} chars extracted</p>}
          </Field>
        )}

        {tab === "youtube" && (
          <Field label={t("decks.youtubeUrl")}>
            <div className="flex gap-2">
              <TextInput value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
              <Button variant="secondary" onClick={handleFetchTranscript} disabled={busy || !youtubeUrl.trim()}>
                {t("decks.fetchTranscript")}
              </Button>
            </div>
          </Field>
        )}

        {tab === "text" && (
          <Field label={t("decks.tabText")}>
            <TextArea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="Paste your notes here…" rows={6} />
          </Field>
        )}

        {tab === "topic" && (
          <Field label={t("explain.topic")}>
            <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("explain.topicPh")} />
          </Field>
        )}

        {aiMissing && <AiNotice message={t("common.aiNotConfigured")} />}
        {error && <p className="font-body text-sm font-bold text-red-600">{error}</p>}

        <Button onClick={handleGenerate} disabled={busy} className="w-full">
          {busy ? t("decks.generating") : t("decks.generatePack")}
        </Button>
      </div>
    </Modal>
  );
}

export default function Decks() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const decksQ = useQuery({ queryKey: ["decks"], queryFn: () => api.get<Deck[]>("/decks") });

  const decks = decksQ.data ?? [];

  return (
    <div>
      <PageBg variant="night" />
      <div className="board-cream mx-auto max-w-4xl p-4 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="title-chunky">Joblings</h1>
          <div className="flex items-center gap-2">
            <Pill>
              {decks.length} / {decks.length}
            </Pill>
            <Link to="/" className="btn-pink btn-sm" aria-label="Home">
              <X className="h-4 w-4" strokeWidth={3} />
            </Link>
          </div>
        </div>

        {decksQ.isLoading ? (
          <LoadingState label={t("common.loading")} />
        ) : decksQ.isError ? (
          <ErrorState message={t("common.error")} onRetry={() => decksQ.refetch()} retryLabel={t("common.retry")} />
        ) : decks.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {decks.map((deck, i) => (
              <Link key={deck.id} to={`/decks/${deck.id}`} className="paper-card relative p-3 text-left">
                <div className="flex items-start justify-between">
                  <span className="font-display text-base font-extrabold text-ink/50">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {i === 0 && <Sticker className="!text-xs">NEW</Sticker>}
                </div>
                <div className="my-2 flex justify-center">
                  <Creature kind={DECK_CREATURES[i % DECK_CREATURES.length]!} size={72} className="animate-bob" />
                </div>
                <h3 className="font-display text-lg font-extrabold leading-tight">{deck.title}</h3>
                <Pill color="bg-btnblue" className="mt-2 !text-xs">
                  {deck.cardCount} {t("decks.cards")}
                </Pill>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title={t("common.empty")}
            hint={t("decks.empty")}
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" strokeWidth={2.75} />
                {t("decks.newFromSource")}
              </Button>
            }
          />
        )}

        <Button variant="yellow" onClick={() => setModalOpen(true)} className="mt-6 w-full">
          <Plus className="h-5 w-5" strokeWidth={2.75} />
          {t("decks.newFromSource")}
        </Button>
      </div>

      {modalOpen && (
        <NewDeckModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["decks"] });
          }}
        />
      )}
    </div>
  );
}
