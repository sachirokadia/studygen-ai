import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Sparkles, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, type Deck, type Note } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, Card, EmptyState, ErrorState, Field, LoadingState, PageHeader, TextArea, TextInput } from "../components/ui";

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
      setSelectedId(null);
      setTitle("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["notes"] });
    },
  });

  const selectNote = (n: Note) => {
    setSelectedId(n.id);
    setTitle(n.title);
    setContent(n.content);
    setGenMsg("");
  };

  const newNote = () => {
    setSelectedId(null);
    setTitle("");
    setContent("");
    setGenMsg("");
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
      <PageHeader
        title={t("notes.title")}
        action={
          <Button onClick={newNote}>
            <Plus className="h-4 w-4" />
            {t("notes.new")}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("notes.search")} className="!pl-9" />
          </div>
          {notesQ.isLoading ? (
            <LoadingState />
          ) : notesQ.isError ? (
            <ErrorState message={t("common.error")} onRetry={() => notesQ.refetch()} retryLabel={t("common.retry")} />
          ) : notesQ.data && notesQ.data.length > 0 ? (
            <div className="space-y-2">
              {notesQ.data.map((n) => (
                <button
                  key={n.id}
                  onClick={() => selectNote(n)}
                  className={clsx(
                    "w-full rounded-xl border p-3 text-left transition",
                    selectedId === n.id ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:bg-slate-50",
                  )}
                >
                  <p className="truncate text-sm font-medium">{n.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{n.content.slice(0, 80)}</p>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState title={t("common.empty")} />
          )}
        </div>

        <Card>
          <Field label={t("decks.deckTitle")}>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Untitled" />
          </Field>
          <div className="mt-3">
            <Field label={`${t("notes.content")} — use {{c1::answer}} for cloze cards`}>
              <TextArea value={content} onChange={(e) => setContent(e.target.value)} rows={12} />
            </Field>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
              {saveMut.isPending ? t("common.loading") : t("btn.save")}
            </Button>
            {selectedId && (
              <Button
                variant="danger"
                onClick={() => {
                  if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate(selectedId);
                }}
                disabled={deleteMut.isPending}
              >
                <Trash2 className="h-4 w-4" />
                {t("btn.delete")}
              </Button>
            )}
          </div>
          {saveMut.isError && <p className="mt-2 text-sm text-red-600">{t("common.error")}</p>}

          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-medium">
              <Sparkles className="mr-1 inline h-4 w-4" />
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
                <Button variant="secondary" onClick={handleGenerateCards} disabled={!targetDeck || clozes.length === 0}>
                  {t("notes.generateCards")}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t("notes.noDecks")}</p>
            )}
            {genMsg && <p className="mt-2 text-sm text-green-600">{genMsg}</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
