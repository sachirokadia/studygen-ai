import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { api, type LearningPath } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, Field, LoadingState, Modal, PageBg, PageHeader, Pill, TextArea, TextInput } from "../components/ui";
import Creature, { OrangeBlob, SpottedDog, type CreatureKind } from "../components/creatures";

const KIND_CYCLE: CreatureKind[] = ["grey", "orange", "chick", "dog"];

export default function Paths() {
  const { t } = useLang();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const pathsQ = useQuery({ queryKey: ["paths"], queryFn: () => api.get<LearningPath[]>("/paths") });

  const createMut = useMutation({
    mutationFn: () => api.post<LearningPath>("/paths", { title: title.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      setModalOpen(false);
      setTitle("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["paths"] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/paths/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["paths"] }),
  });

  return (
    <div>
      <PageBg variant="sky" />
      <PageHeader
        title={t("nav.paths")}
        action={
          <Button variant="yellow" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" strokeWidth={2.75} />
            {t("paths.new")}
          </Button>
        }
      />

      {pathsQ.isLoading ? (
        <LoadingState label={t("common.loading")} />
      ) : pathsQ.isError ? (
        <ErrorState message={t("common.error")} onRetry={() => pathsQ.refetch()} retryLabel={t("common.retry")} />
      ) : pathsQ.data && pathsQ.data.length > 0 ? (
        <div className="board-red p-4 md:p-6">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pathsQ.data.map((p, idx) => {
              const total = p.topics?.length ?? 0;
              const done = p.topics?.filter((x) => x.status === "done").length ?? 0;
              return (
                <div key={p.id} className="paper-card washi relative p-4 pt-5">
                  <div className="mb-2 flex items-center gap-3">
                    <Creature kind={KIND_CYCLE[idx % KIND_CYCLE.length]} size={56} className="animate-bob" />
                    <Link to={`/paths/${p.id}`}>
                      <h3 className="font-display text-xl font-extrabold uppercase leading-tight hover:underline">{p.title}</h3>
                    </Link>
                  </div>
                  {p.description && (
                    <p className="line-clamp-2 font-body text-sm font-semibold text-ink/60">{p.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {total > 0 && (
                      <Pill color={done === total ? "bg-grass" : "bg-btnyellow"}>
                        {done}/{total} {t("paths.done")}
                      </Pill>
                    )}
                    <div className="flex-1" />
                    <Link to={`/paths/${p.id}`} className="btn-blue btn-sm">
                      OPEN
                    </Link>
                    <Button
                      variant="pink"
                      className="btn-sm"
                      onClick={() => {
                        if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate(p.id);
                      }}
                      aria-label="Delete path"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2.75} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-end justify-center gap-8">
            <OrangeBlob size={88} className="animate-bob" />
            <SpottedDog size={88} className="animate-bob" />
          </div>
        </div>
      ) : (
        <EmptyState
          title={t("paths.empty")}
          action={
            <Button variant="yellow" onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4" strokeWidth={2.75} />
              {t("paths.new")}
            </Button>
          }
        />
      )}

      {modalOpen && (
        <Modal title={t("paths.new")} onClose={() => setModalOpen(false)}>
          <div className="space-y-4">
            <Field label={t("decks.deckTitle")}>
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Web Development" />
            </Field>
            <Field label={t("paths.topicDesc")}>
              <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </Field>
            <Button variant="blue" onClick={() => createMut.mutate()} disabled={createMut.isPending || !title.trim()} className="w-full">
              {createMut.isPending ? t("common.loading") : t("btn.create")}
            </Button>
            {createMut.isError && <p className="font-body text-sm font-bold text-red-700">{t("common.error")}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
