import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { api, type LearningPath } from "../lib/api";
import { useLang } from "../lib/i18n";
import { Button, EmptyState, ErrorState, Field, LoadingState, Modal, PageBg, PageHeader, Pill, TextArea, TextInput } from "../components/ui";
import Creature, { type CreatureKind } from "../components/creatures";

const KIND_CYCLE: CreatureKind[] = ["grey", "orange", "chick", "dog"];
const BANDS = ["bg-lavender", "bg-mint", "bg-peach", "bg-sky"];

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
          <Button variant="primary" onClick={() => setModalOpen(true)} className="!h-auto !w-auto btn-sm">
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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pathsQ.data.map((p, idx) => {
            const total = p.topics?.length ?? 0;
            const done = p.topics?.filter((x) => x.status === "done").length ?? 0;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div key={p.id} className="card overflow-hidden">
                <div className={clsx("flex items-center justify-between px-4 py-2.5", BANDS[idx % BANDS.length])}>
                  <Creature kind={KIND_CYCLE[idx % KIND_CYCLE.length]} size={44} className="animate-float" />
                  {total > 0 && (
                    <Pill color="bg-white/80">
                      {done}/{total} {t("paths.done")}
                    </Pill>
                  )}
                </div>
                <div className="p-5">
                  <Link to={`/paths/${p.id}`}>
                    <h3 className="text-xl font-extrabold tracking-tight text-ink hover:underline">{p.title}</h3>
                  </Link>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-muted">{p.description}</p>
                  )}
                  {total > 0 && (
                    <div className="mt-4">
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="mt-1.5 text-xs font-bold text-muted">
                        {done}/{total} {t("paths.done")} · {pct}%
                      </p>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-2">
                    <Link to={`/paths/${p.id}`} className="btn-dark btn-sm flex-1 text-center">
                      OPEN
                    </Link>
                    <Button
                      variant="danger"
                      className="btn-sm !px-3"
                      onClick={() => {
                        if (window.confirm(t("common.confirmDelete"))) deleteMut.mutate(p.id);
                      }}
                      aria-label="Delete path"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2.75} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t("paths.empty")}
          action={
            <Button onClick={() => setModalOpen(true)} className="!w-auto">
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
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !title.trim()}>
              {createMut.isPending ? t("common.loading") : t("btn.create")}
            </Button>
            {createMut.isError && <p className="text-sm font-bold text-red-700">{t("common.error")}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
