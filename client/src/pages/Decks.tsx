import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { FileText, Link2, Plus, Type, Lightbulb, X, Search } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type Deck, type StudyPackResult } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, Field, LoadingState, Modal, PageBg, Pill, Sticker, TextArea, TextInput } from "../components/ui";
import { AiNotice } from "../components/ui";
import Creature, { type CreatureKind } from "../components/creatures";

type SourceTab = "pdf" | "youtube" | "text" | "topic";

const DECK_CREATURES: CreatureKind[] = ["grey", "orange", "chick", "dog"];

async function extractPdfText(file: File): Promise<{ text: string; truncated: boolean }> {
  const pdfjs = await import("pdfjs-dist");
  const workerModule = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")) as { default: string };
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const maxPages = Math.min(pdf.numPages, 40);
  const truncated = pdf.numPages > 40;
  let text = "";
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text +=
      content.items
        .map((item) => (typeof (item as { str?: string }).str === "string" ? (item as { str: string }).str : ""))
        .join(" ") + "\n";
  }
  const sliced = text.slice(0, 60_000);
  return { text: sliced, truncated: truncated || text.length > 60_000 };
}

function NewDeckModal({ onClose, onCreated }: { onClose: () => void; onCreated: (deckId?: string) => void }) {
  const { t } = useLang();
  const [tab, setTab] = useState<SourceTab>("topic");
  const [title, setTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [topic, setTopic] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfTruncated, setPdfTruncated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [aiMissing, setAiMissing] = useState(false);

  const activeTab: SourceTab = tab;

  const tabs: { id: SourceTab; label: string; icon: typeof FileText }[] = [
    { id: "topic", label: t("decks.tabTopic"), icon: Lightbulb },
    { id: "pdf", label: t("decks.tabPdf"), icon: FileText },
    { id: "youtube", label: t("decks.tabYoutube"), icon: Link2 },
    { id: "text", label: t("decks.tabText"), icon: Type },
  ];

  const handlePdf = async (file: File) => {
    setPdfName(file.name);
    if (!title) setTitle(file.name.replace(/\.pdf$/i, ""));
    setBusy(true);
    setError("");
    setPdfTruncated(false);
    try {
      const { text, truncated } = await extractPdfText(file);
      setTextContent(text);
      setPdfTruncated(truncated);
      if (!text.trim()) {
        // Scanned/image PDFs extract zero text — the generate button would stay
        // disabled with no explanation. Say so instead of leaving the user stuck.
        setError(t("decks.pdfEmpty"));
      }
    } catch {
      setError(t("decks.pdfError"));
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
    } catch {
      setError(t("decks.transcriptError"));
    } finally {
      setBusy(false);
    }
  };

  const handleEmptyPack = async () => {
    const finalTitle = topic.trim() || title.trim() || "Untitled";
    setBusy(true);
    setError("");
    try {
      const deck = await api.post<Deck>("/decks", { title: finalTitle, sourceType: "topic" });
      onCreated(deck.id);
    } catch {
      setError(t("decks.createError"));
    } finally {
      setBusy(false);
    }
  };

  // Fix 2: button enabled based on the active source tab, not just the topic field.
  const canGenerate =
    !busy &&
    (activeTab === "topic" ? topic.trim().length > 0 : textContent.trim().length > 0);

  const handleGenerate = async () => {
    // Fix 1: wrap short topics so the server's 20-char minimum never rejects them.
    let content: string;
    if (activeTab === "topic") {
      const raw = topic.trim();
      if (!raw) {
        setError(t("decks.needTopic"));
        return;
      }
      content = `Create a complete study pack about: ${raw}`;
    } else {
      content = textContent.trim();
      if (!content) {
        setError(t("decks.needContent"));
        return;
      }
    }
    const finalTitle =
      title.trim() ||
      topic.trim() ||
      (activeTab === "youtube" ? "YouTube video" : pdfName || "Untitled");
    setBusy(true);
    setError("");
    setAiMissing(false);
    // Fix 3: clear progress states while generating.
    const steps = [t("decks.progressReading"), t("decks.progressCards"), t("decks.progressQuiz")];
    let stepIdx = 0;
    setProgress(steps[0]!);
    const timer = setInterval(() => {
      stepIdx = Math.min(stepIdx + 1, steps.length - 1);
      setProgress(steps[stepIdx]!);
    }, 8000);
    try {
      const res = await api.post<StudyPackResult>("/ai/study-pack", {
        title: finalTitle,
        sourceType: activeTab,
        sourceName: activeTab === "pdf" ? pdfName : activeTab === "youtube" ? youtubeUrl : undefined,
        content: content.slice(0, 60_000),
      });
      clearInterval(timer);
      setProgress("");
      onCreated(res.deckId);
    } catch (err) {
      clearInterval(timer);
      setProgress("");
      // Fix 1: friendly messages instead of raw server text.
      if (err instanceof ApiError && err.status === 503) setAiMissing(true);
      else setError(t("decks.generateError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={t("decks.newPack")} onClose={onClose}>
      <div className="space-y-4">
        {/* Fix 10: source tabs always visible, no "More options" gate. */}
        <div className="grid grid-cols-4 gap-2">
          {tabs.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} className="flex justify-center" type="button">
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

        {tab === "topic" && (
          <Field label={t("decks.whatToLearn")}>
            <TextInput
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t("explain.topicPh")}
              className="!py-4 !text-xl"
              autoFocus
            />
          </Field>
        )}

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
            {pdfName && <p className="mt-1 font-body text-xs font-bold text-ink/60">{pdfName}</p>}
            {/* Fix 10: warn when the PDF was truncated. */}
            {pdfTruncated && (
              <p className="mt-2 font-body text-sm font-bold text-amber-700">{t("decks.pdfTruncated")}</p>
            )}
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
            {textContent && tab === "youtube" && (
              <p className="mt-1 font-body text-xs font-bold text-green-700">{t("decks.transcriptReady")}</p>
            )}
          </Field>
        )}

        {tab === "text" && (
          <Field label={t("decks.tabText")}>
            <TextArea value={textContent} onChange={(e) => setTextContent(e.target.value)} placeholder="Paste your notes here…" rows={6} />
          </Field>
        )}

        <Field label={t("decks.deckTitle")}>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={topic || "Cell Biology 101"} />
        </Field>

        <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full !py-4 !text-2xl">
          {busy ? progress || t("decks.making") : t("decks.makeMyCards")}
        </Button>

        <Button variant="cream" onClick={handleEmptyPack} disabled={busy} className="w-full !py-3 !text-xl">
          {t("decks.emptyPack")}
        </Button>

        {aiMissing && <AiNotice message={t("common.aiNotConfigured")} />}
        {error && (
          <div className="text-center">
            <p className="font-body text-sm font-bold text-red-600">{error}</p>
            <button
              onClick={handleGenerate}
              className="mt-2 font-display text-lg font-extrabold text-ink underline decoration-btnyellow decoration-[3px] underline-offset-4"
            >
              {t("common.retry")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default function Decks() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"az" | "newest" | "most">("newest");

  const decksQ = useQuery({ queryKey: ["decks"], queryFn: () => api.get<Deck[]>("/decks") });

  const allDecks = decksQ.data ?? [];
  const q = search.trim().toLowerCase();
  const decks = allDecks
    .filter((d) => !q || d.title.toLowerCase().includes(q))
    .sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "most") return (b.cardCount ?? 0) - (a.cardCount ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  return (
    <div>
      <PageBg variant="night" />
      <div className="board-cream mx-auto max-w-4xl p-4 md:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="title-chunky">{t("decks.title")}</h1>
          <Link to="/" className="btn-pink btn-sm" aria-label={t("nav.home")}>
            <X className="h-4 w-4" strokeWidth={3} />
          </Link>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/50" strokeWidth={2.75} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("decks.search")}
              className="input !pl-10"
              aria-label={t("decks.search")}
            />
          </div>
          <label className="flex items-center gap-2">
            <span className="font-display text-sm font-extrabold uppercase text-ink/60">{t("decks.sortLabel")}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "az" | "newest" | "most")}
              className="input !w-auto cursor-pointer !py-2 font-display font-extrabold"
              aria-label={t("decks.sortLabel")}
            >
              <option value="newest">{t("decks.sortNewest")}</option>
              <option value="az">{t("decks.sortAZ")}</option>
              <option value="most">{t("decks.sortMost")}</option>
            </select>
          </label>
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
                  {i === 0 && <Sticker className="!text-xs">{t("decks.new")}</Sticker>}
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
            title={t("decks.empty")}
            action={
              <Button onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" strokeWidth={2.75} />
                {t("decks.newPack")}
              </Button>
            }
          />
        )}

        <Button variant="yellow" onClick={() => setModalOpen(true)} className="mt-6 w-full !py-4 !text-2xl">
          <Plus className="h-5 w-5" strokeWidth={2.75} />
          {t("decks.newPack")}
        </Button>
      </div>

      {modalOpen && (
        <NewDeckModal
          onClose={() => setModalOpen(false)}
          onCreated={(deckId) => {
            setModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["decks"] });
            // Fix 3: take the user straight to their new deck.
            if (deckId) navigate(`/decks/${deckId}`);
          }}
        />
      )}
    </div>
  );
}
