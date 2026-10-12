import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { api, type Deck, type Note } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, Field, LoadingState, Modal, PageBg, PageHeader, TextArea, TextInput } from "../components/ui";
import BookmarkToggle from "../components/BookmarkToggle";

interface Cloze {
  ordinal: string;
  answer: string;
  hint?: string;
}

function parseClozes(content: string): Cloze[] {
  const re = /\{\{(c\d+)::([^}:]+?)(?:::([^}]+?))?\}\}/g;
  const out: Cloze[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    out.push({ ordinal: m[1]!, answer: m[2]!.trim(), hint: m[3]?.trim() });
  }
  return out;
}

function clozeToCard(content: string, cloze: Cloze): { front: string; back: string } {
  // Blank only this ordinal's clozes; keep other text intact.
  const re = new RegExp(`\\{\\{${cloze.ordinal}::[^}]+?\\}\\}`, "g");
  const front = content.replace(re, cloze.hint ? `_____ (${cloze.hint})` : "_____");
  return { front, back: cloze.answer };
}

export default function Notes() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetDeck, setTargetDeck] = useState("");
  const [genMsg, setGenMsg] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const notesQ = useQuery({
    queryKey: ["notes", debounced],
    queryFn: () => api.get<Note[]>(`/notes${debounced ? `?q=${encodeURIComponent(debounced)}` : ""}`),
  });
  const decksQ = useQuery({ queryKey: ["decks"], queryFn: () => api.get<Deck[]>("/decks") });

  const saveMut = useMutation({
    mutationFn: () => {
      const body = { title: title.trim() || "Untitled", content };
      return selectedId ? api.patch<Note>(`/notes/${selectedId}`, body) : api.post<Note>("/notes", body);
    },
    onSuccess: (note) => {
      setSelectedId(note.id);
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/notes/${id}`),
    onSuccess: () => {
      setEditorOpen(false);
      setSelectedId(null);
      setTitle("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const openEditor = (n: Note | null) => {
    setSelectedId(n?.id ?? null);
    setTitle(n?.title ?? "");
    setContent(n?.content ?? "");
    setGenMsg("");
    setEditorOpen(true);
  };

  const handleGenerateCards = async () => {
    const clozes = parseClozes(content);
    if (clozes.length === 0 || !targetDeck) return;
    setGenMsg("");
    try {
      // Dedupe by ordinal — one card per cloze group.
      const seen = new Set<string>();
      let created = 0;
      for (const c of clozes) {
        if (seen.has(c.ordinal)) continue;
        seen.add(c.ordinal);
        const { front, back } = clozeToCard(content, c);
        await api.post("/flashcards", { deckId: targetDeck, front, back });
        created++;
      }
      setGenMsg(`${created} ${t("notes.cardsCreated")}`);
    } catch {
      setGenMsg(t("common.error"));
    }
  };

  const clozes = parseClozes(content);

  return (
    <div>
      <PageBg variant="sky" />
      <PageHeader
        title={t("nav.notes")}
        action={
          <button onClick={() => openEditor(null)} className="btn-primary btn-sm !w-auto">
            <Plus className="h-4 w-4" strokeWidth={2.75} />
            {t("notes.new")}
          </button>
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("notes.search")} className="!pl-9" />
      </div>

      {notesQ.isLoading ? (
        <LoadingState />
      ) : notesQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => notesQ.refetch()} retryLabel={t("common.retry")} />
      ) : notesQ.data && notesQ.data.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {notesQ.data.map((n) => (
            <div
              key={n.id}
              onClick={() => openEditor(n)}
              className="card relative cursor-pointer p-4 transition active:scale-[0.98]"
            >
              <p className="truncate text-xl font-extrabold uppercase leading-tight tracking-tight text-ink">{n.title}</p>
              <p className="mt-1 line-clamp-3 text-xs font-semibold text-ink/60">{n.content.slice(0, 120)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span onClick={(e) => e.stopPropagation()}>
                  <BookmarkToggle kind="note" refId={n.id} label={n.title} />
                </span>
                <Button
                  variant="soft"
                  className="btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditor(n);
                  }}
                >
                  <Pencil className="h-4 w-4" strokeWidth={2.75} />
                  {t("btn.edit")}
                </Button>
                <Button
                  variant="pink"
                  className="btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate(n.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2.75} />
                  {t("btn.delete")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={t("common.empty")} />
      )}

      {editorOpen && (
        <Modal title={selectedId ? title || t("notes.title") : t("notes.new")} onClose={() => setEditorOpen(false)}>
          <Field label={t("decks.deckTitle")}>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
          </Field>
          <div className="mt-3">
            <Field label={t("notes.clozeHint")}>
              <TextArea value={content} onChange={(e) => setContent(e.target.value)} rows={12} />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? t("common.loading") : t("btn.save")}
            </Button>
            {selectedId && (
              <Button
                variant="pink"
                onClick={() => {
                  if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate(selectedId);
                }}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="h-4 w-4" strokeWidth={2.75} />
                {t("btn.delete")}
              </Button>
            )}
          </div>
          {saveMut.isError && <p className="mt-2 text-sm font-bold text-red-600">{t("common.error")}</p>}

          <div className="mt-6 border-t-2 border-dashed border-[#ECECF1] pt-4">
            <p className="mb-2 text-xl font-extrabold uppercase tracking-tight text-ink">
              <Sparkles className="mr-1 inline h-4 w-4" strokeWidth={2.75} />
              {t("notes.generateCards")} ({clozes.length})
            </p>
            {decksQ.data && decksQ.data.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                <select value={targetDeck} onChange={(e) => setTargetDeck(e.target.value)} className="input !w-auto">
                  <option value="">{t("notes.pickDeck")}</option>
                  {decksQ.data.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
                <Button variant="soft" onClick={handleGenerateCards} disabled={!targetDeck || clozes.length === 0}>
                  {t("notes.generateCards")}
                </Button>
              </div>
            ) : (
              <p className="text-sm font-semibold text-ink/60">{t("notes.noDecks")}</p>
            )}
            {genMsg && <p className="mt-2 text-xl font-extrabold uppercase tracking-tight text-ink">{genMsg}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
